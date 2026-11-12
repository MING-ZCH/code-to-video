// assets.mjs: real-world media for the realism layer (engine/real.js). Search public libraries, fetch one item,
// record where it came from, and turn it into what the engine reads.
//
//   c2v assets <p> search <source> <query> [--type=video|image|hdri|texture|model] [--n=8]
//   c2v assets <p> fetch  <source>:<id> --as=<name> [--res=2k] [--start=0] [--dur=6] [--fps=24] [--w=1920] [--key=green]
//   c2v assets <p> list | credits | restore
//
// Sources (no key unless noted): wikimedia (Commons images and videos), nasa (images-api.nasa.gov), polyhaven (CC0 HDRIs,
// PBR textures, models), archive (Internet Archive movies), pexels (PEXELS_API_KEY), pixabay (PIXABAY_API_KEY),
// url:<https://…> (pass --license and --author), file:<path>.
//
// Every fetch is appended to projects/<p>/assets.lock.json (source, id, url, licence, author, sha256 of the download,
// processing options), which is committed; the media under projects/<p>/assets/ is not. `restore` re-fetches every
// entry and refuses a download whose sha256 differs. Videos become JPEG frame sequences at the project's fps, so a frame
// is a file and footage() stays a pure function of t. assets/assets.js (window.ASSET_META) is regenerated after every
// change; studio.html loads it when PROJECT.footage is set.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const UA = 'code-to-video-assets/0.1 (https://github.com/MING-ZCH/code-to-video)';
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

// Public media hosts rate-limit (429) and some connections drop mid-handshake: retry with backoff, honouring Retry-After.
async function get(url, headers = {}, tries = 6) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' });
      if (r.ok) return r;
      if (![429, 500, 502, 503, 504].includes(r.status) || k >= tries - 1) throw Object.assign(new Error(`${r.status} ${url}`), { final: true });
      await new Promise(ok => setTimeout(ok, 1000 * Math.max(+r.headers.get('retry-after') || 0, 2 ** k)));
    } catch (e) {
      if (e.final || k >= tries - 1) throw e;
      await new Promise(ok => setTimeout(ok, 1000 * 2 ** k));
    }
  }
}
const getJSON = async (url, headers = {}) => (await get(url, headers)).json();
async function download(url, dest, headers = {}) {
  const buf = Buffer.from(await (await get(url, headers)).arrayBuffer());
  mkdirSync(join(dest, '..'), { recursive: true }); writeFileSync(dest, buf);
  return sha256(buf);
}
const strip = html => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---------- sources: search(query, o) → [{ id, title, type, license, author, preview }], resolve(id, o) → { url, license, author, page, type, files? } ----------
const SOURCES = {
  wikimedia: {
    async search(q, o) {
      const ft = o.type === 'image' ? 'filetype:bitmap' : 'filetype:video';
      const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(ft + ' ' + q)}&gsrnamespace=6&gsrlimit=${o.n}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json`;
      const d = await getJSON(u);
      return Object.values(d.query?.pages || {}).map(p => { const i = p.imageinfo[0], m = i.extmetadata || {};
        return { id: p.title.replace(/^File:/, ''), title: p.title, type: i.mime, size: `${i.width}x${i.height}`, dur: i.duration, license: m.LicenseShortName?.value, author: strip(m.Artist?.value) }; });
    },
    async resolve(id) {
      const d = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + id)}&prop=imageinfo|videoinfo&iiprop=url|mime|size|extmetadata&viprop=derivatives&format=json`);
      const p = Object.values(d.query.pages)[0], i = p.imageinfo[0], m = i.extmetadata || {}, video = /^(video|application\/ogg)/.test(i.mime);
      // large originals (4K webm, 200 MB+) come down as Commons' own 1080p transcode when there is one
      const t1080 = video && i.width > 1920 ? (p.videoinfo?.[0]?.derivatives || []).find(x => /^1080p\./.test(x.transcodekey || '')) : null;
      return { url: t1080 ? t1080.src : i.url, page: i.descriptionurl, type: video ? 'video' : 'image', license: m.LicenseShortName?.value || 'unknown', author: strip(m.Artist?.value) || 'unknown' };
    },
  },
  nasa: {
    async search(q, o) {
      const d = await getJSON(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=${o.type === 'image' ? 'image' : 'video'}&page_size=${o.n}`);
      return d.collection.items.slice(0, o.n).map(it => { const m = it.data[0]; return { id: m.nasa_id, title: m.title, type: m.media_type, license: 'NASA media (public domain, see guidelines)', author: m.center || 'NASA' }; });
    },
    async resolve(id, o) {
      const files = (await getJSON(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`)).collection.items.map(x => x.href);
      const pick = files.find(f => /~orig\.mp4$/i.test(f)) || files.find(f => /~large\.mp4$/i.test(f)) || files.find(f => /\.mp4$/i.test(f)) || files.find(f => /~orig\.jpe?g$/i.test(f)) || files.find(f => /\.(jpe?g|png)$/i.test(f));
      if (!pick) throw new Error(`nasa ${id}: no mp4/jpg file`);
      // the item's own metadata travels with the asset (ASSET_META[name].facts), so on-screen facts quote the source
      const m = (await getJSON(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(id)}`)).collection.items[0]?.data[0] || {};
      const facts = { title: m.title, date: (m.date_created || '').slice(0, 10), center: m.center, description: m.description, keywords: m.keywords };
      return { url: pick.replace(/^http:/, 'https:').replace(/ /g, '%20'), page: `https://images.nasa.gov/details/${encodeURIComponent(id)}`, type: /\.mp4$/i.test(pick) ? 'video' : 'image', license: 'NASA media (public domain; no endorsement implied)', author: 'NASA', facts };
    },
  },
  polyhaven: {
    async search(q, o) {
      const t = { hdri: 'hdris', texture: 'textures', model: 'models' }[o.type || 'hdri'] || 'hdris';
      const all = await getJSON(`https://api.polyhaven.com/assets?t=${t}`), ql = q.toLowerCase().split(/\s+/).filter(Boolean);
      return Object.entries(all).filter(([id, a]) => ql.every(w => (id + ' ' + a.name + ' ' + (a.tags || []).join(' ') + ' ' + (a.categories || []).join(' ')).toLowerCase().includes(w)))
        .sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0)).slice(0, o.n)
        .map(([id, a]) => ({ id, title: a.name, type: o.type || 'hdri', license: 'CC0', author: Object.keys(a.authors || {}).join(', ') }));
    },
    async resolve(id, o) {
      const [info, files] = await Promise.all([getJSON(`https://api.polyhaven.com/info/${id}`), getJSON(`https://api.polyhaven.com/files/${id}`)]);
      const res = o.res || '2k', author = Object.keys(info.authors || {}).join(', '), page = `https://polyhaven.com/a/${id}`;
      if (info.type === 0) return { type: 'hdri', url: files.hdri[res].hdr.url, page, license: 'CC0', author };
      if (info.type === 2) {      // a model: the .gltf plus every file it includes, kept in their relative layout
        const g = files.gltf[res].gltf, extra = Object.entries(g.include || {}).map(([rel, f]) => ({ rel, url: f.url }));
        return { type: 'model', url: g.url, files: [{ rel: basename(new URL(g.url).pathname), url: g.url }, ...extra], page, license: 'CC0', author };
      }
      const maps = {}; for (const k of ['Diffuse', 'nor_gl', 'Rough', 'AO', 'Displacement', 'arm', 'Metal']) if (files[k]?.[res]) maps[k] = (files[k][res].jpg || files[k][res].png).url;
      return { type: 'texture', url: Object.values(maps)[0], files: Object.entries(maps).map(([k, url]) => ({ rel: `${k}${extname(new URL(url).pathname)}`, url })), page, license: 'CC0', author };
    },
  },
  archive: {
    async search(q, o) {
      const d = await getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q + ' AND mediatype:movies')}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&rows=${o.n}&output=json`);
      return d.response.docs.map(x => ({ id: x.identifier, title: x.title, type: 'video', license: x.licenseurl || 'see item page', author: [].concat(x.creator || 'unknown').join(', ') }));
    },
    async resolve(id) {
      const m = await getJSON(`https://archive.org/metadata/${encodeURIComponent(id)}`);
      const f = m.files.filter(x => /\.mp4$/i.test(x.name)).sort((a, b) => (+b.size || 0) - (+a.size || 0))[0];
      if (!f) throw new Error(`archive ${id}: no mp4`);
      return { type: 'video', url: `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`, page: `https://archive.org/details/${id}`, license: m.metadata.licenseurl || 'see item page', author: [].concat(m.metadata.creator || 'unknown').join(', ') };
    },
  },
  pexels: {
    key: () => { const k = process.env.PEXELS_API_KEY; if (!k) throw new Error('set PEXELS_API_KEY'); return { Authorization: k }; },
    async search(q, o) {
      const img = o.type === 'image', d = await getJSON(`https://api.pexels.com/${img ? 'v1' : 'videos'}/search?query=${encodeURIComponent(q)}&per_page=${o.n}`, this.key());
      return (img ? d.photos : d.videos).map(v => ({ id: String(v.id), title: v.url, type: img ? 'image' : 'video', size: `${v.width}x${v.height}`, dur: v.duration, license: 'Pexels License', author: v.user?.name || v.photographer }));
    },
    async resolve(id, o) {
      if (o.type === 'image') { const p = await getJSON(`https://api.pexels.com/v1/photos/${id}`, this.key()); return { type: 'image', url: p.src.original, page: p.url, license: 'Pexels License', author: p.photographer }; }
      const v = await getJSON(`https://api.pexels.com/videos/videos/${id}`, this.key());
      const f = v.video_files.filter(x => x.file_type === 'video/mp4' && x.width).sort((a, b) => Math.abs(a.width - 1920) - Math.abs(b.width - 1920))[0];
      return { type: 'video', url: f.link, page: v.url, license: 'Pexels License', author: v.user?.name || 'unknown' };
    },
  },
  pixabay: {
    key: () => { const k = process.env.PIXABAY_API_KEY; if (!k) throw new Error('set PIXABAY_API_KEY'); return k; },
    async search(q, o) {
      const img = o.type === 'image', d = await getJSON(`https://pixabay.com/api/${img ? '' : 'videos/'}?key=${this.key()}&q=${encodeURIComponent(q)}&per_page=${Math.max(3, o.n)}`);
      return d.hits.map(h => ({ id: String(h.id), title: h.tags, type: img ? 'image' : 'video', dur: h.duration, license: 'Pixabay Content License', author: h.user }));
    },
    async resolve(id, o) {
      const img = o.type === 'image', h = (await getJSON(`https://pixabay.com/api/${img ? '' : 'videos/'}?key=${this.key()}&id=${id}`)).hits[0];
      return { type: img ? 'image' : 'video', url: img ? h.largeImageURL : (h.videos.large.url || h.videos.medium.url), page: h.pageURL, license: 'Pixabay Content License', author: h.user };
    },
  },
};

// ---------- processing ----------
const ff = args => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { maxBuffer: 1 << 26 }); if (r.status) throw new Error(String(r.stderr)); };
const probe = f => { const d = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', f]).stdout); const v = d.streams.find(s => s.codec_type === 'video') || {}; return { w: v.width, h: v.height, dur: +d.format?.duration || 0 }; };

function processVideo(src, dir, o) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const base = +(o.fps || 24), w = +(o.w || 1920), interp = +(o.interp || 1), fps = base * interp;
  // the source is cut first (input-side seek is frame-accurate after decoding in ffmpeg ≥ 4), then resampled to the project
  // fps, so frame i of the sequence is source time start + i / fps. --interp=N adds motion-compensated in-between frames
  // (ffmpeg minterpolate, block-matching optical flow) for slow motion without held or ghosted frames.
  const mci = interp > 1 ? `,minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1` : '';
  ff([...(o.start ? ['-ss', String(o.start)] : []), '-i', src, ...(o.dur ? ['-t', String(o.dur)] : []), '-an',
    '-vf', `fps=${base},scale=${w}:-2:flags=lanczos${mci}`, '-q:v', '2', join(dir, 'f%05d.jpg')]);
  const frames = readdirSync(dir).filter(f => /^f\d{5}\.jpg$/.test(f)).length;
  const { w: fw, h: fh } = probe(join(dir, 'f00001.jpg'));
  return { kind: 'video', frames, fps, w: fw, h: fh, dur: frames / fps, start: +(o.start || 0) };
}
function processImage(src, dir, o) {
  mkdirSync(dir, { recursive: true }); const out = join(dir, 'image.jpg'), w = +(o.w || 0);
  ff(['-i', src, ...(w ? ['-vf', `scale=${w}:-2:flags=lanczos`] : []), '-q:v', '2', out]);
  const { w: iw, h: ih } = probe(out); return { kind: 'image', file: 'image.jpg', w: iw, h: ih };
}

// ---------- lock file and engine manifest ----------
const lockPath = p => join(p, 'assets.lock.json');
export const readLock = p => existsSync(lockPath(p)) ? JSON.parse(readFileSync(lockPath(p), 'utf8')) : { assets: {} };
function writeLock(p, lock) { writeFileSync(lockPath(p), JSON.stringify(lock, null, 1) + '\n'); writeManifest(p, lock); }
function writeManifest(p, lock) {
  const meta = {}; for (const [name, a] of Object.entries(lock.assets)) meta[name] = { ...a.meta, dir: `assets/${name}` };
  mkdirSync(join(p, 'assets'), { recursive: true });
  writeFileSync(join(p, 'assets', 'assets.js'), `// generated by c2v assets from assets.lock.json: do not edit\nwindow.ASSET_META = ${JSON.stringify(meta, null, 1)};\n`);
}

export async function search(source, query, o = {}) {
  const s = SOURCES[source]; if (!s) throw new Error(`unknown source "${source}" (${Object.keys(SOURCES).join(', ')})`);
  return s.search.call(s, query, { n: +(o.n || 8), type: o.type });
}

/**
 * Fetch one asset into projects/<p>/assets/<name>/ and record it in the lock.
 * ref: "<source>:<id>", "url:<https://…>" or "file:<path>". o: { as, res, start, dur, fps, w, type, license, author, expectSha }.
 */
export async function fetchAsset(pdir, ref, o = {}) {
  const i = ref.indexOf(':'), source = ref.slice(0, i), id = ref.slice(i + 1), name = o.as;
  if (!name || !/^[\w-]+$/.test(name)) throw new Error('--as=<name> is required (letters, digits, _ and -)');
  const raw = join(pdir, 'assets', '_raw'), dir = join(pdir, 'assets', name); mkdirSync(raw, { recursive: true });
  let info;
  if (source === 'url' && /\.(glb|gltf|fbx|bvh|blend)$/i.test(new URL(id).pathname))     // a single-file model or motion clip
    info = { url: id, page: o.page || id, type: 'model', files: [{ rel: basename(new URL(id).pathname), url: id }], license: o.license || 'unspecified', author: o.author || 'unspecified' };
  else if (source === 'url') info = { url: id, page: id, type: o.type || (/\.(mp4|webm|mov|mkv)$/i.test(id) ? 'video' : 'image'), license: o.license || 'unspecified', author: o.author || 'unspecified' };
  else if (source === 'file') info = { url: null, page: id, type: o.type || (/\.(mp4|webm|mov|mkv)$/i.test(id) ? 'video' : 'image'), license: o.license || 'own', author: o.author || 'own' };
  else { const s = SOURCES[source]; if (!s) throw new Error(`unknown source "${source}"`); info = await s.resolve.call(s, id, o); }

  let sha, meta;
  if (info.type === 'model' || info.type === 'texture') {   // several files, kept as delivered (Blender and three.js read them directly)
    rmSync(dir, { recursive: true, force: true }); const h = createHash('sha256');
    for (const f of info.files) { const s = await download(f.url, join(dir, f.rel)); h.update(f.rel + s); }
    sha = h.digest('hex'); meta = { kind: info.type, files: info.files.map(f => f.rel) };
  } else {
    const ext = extname(new URL(info.url || 'file:///' + id).pathname) || (info.type === 'video' ? '.mp4' : '.jpg'), src = join(raw, name + ext);
    const prev = Object.values(readLock(pdir).assets).find(a => a.source === source && a.id === id && a.url === info.url);
    if (source === 'file') { copyFileSync(id, src); sha = sha256(readFileSync(src)); }
    else if (prev && existsSync(src) && sha256(readFileSync(src)) === prev.sha256) sha = prev.sha256;      // same download already on disk (re-cut)
    else sha = await download(info.url, src);
    if (o.expectSha && o.expectSha !== sha) throw new Error(`${name}: sha256 ${sha.slice(0, 12)} ≠ locked ${o.expectSha.slice(0, 12)} (the source changed)`);
    if (info.type === 'hdri') { mkdirSync(dir, { recursive: true }); copyFileSync(src, join(dir, 'env.hdr')); meta = { kind: 'hdri', file: 'env.hdr' }; }
    else meta = info.type === 'video' ? processVideo(src, dir, o) : processImage(src, dir, o);
  }
  if (info.facts) meta.facts = info.facts;
  const lock = readLock(pdir);
  lock.assets[name] = { source, id, url: info.url, page: info.page, license: info.license, author: info.author, sha256: sha,
    opts: Object.fromEntries(['res', 'start', 'dur', 'fps', 'w', 'type', 'interp'].filter(k => o[k] !== undefined).map(k => [k, o[k]])), meta, fetched: new Date().toISOString() };
  writeLock(pdir, lock);
  return lock.assets[name];
}

/**
 * Record a Blender-rendered layer (c2v blender) in the lock. Its "source" is code: the hash covers the scene file, the
 * shared helpers and the params, so a changed scene or param shows up as a changed sha256.
 */
export function registerLayer(pdir, name, scene, meta) {
  const h = createHash('sha256').update(readFileSync(scene)).update(readFileSync('blender/c2v_bpy.py')).update(JSON.stringify(meta.params));
  const lock = readLock(pdir), { params, measure, ...m } = meta;
  lock.assets[name] = { source: 'blender', id: scene, url: null, page: scene, license: 'own (rendered from code)', author: 'c2v', sha256: h.digest('hex'),
    opts: { params, frames: meta.frames, samples: meta.samples, w: meta.w, h: meta.h },
    meta: { kind: 'video', frames: m.frames, fps: m.fps, w: m.w, h: m.h, dur: m.dur, params, ...(measure ? { measure } : {}) }, render: m, fetched: new Date().toISOString() };
  writeLock(pdir, lock);
  return lock.assets[name];
}

export async function restore(pdir) {
  const lock = readLock(pdir), out = [];
  for (const [name, a] of Object.entries(lock.assets)) {
    if (a.source === 'blender') { out.push(`${name}: rendered layer, re-render with c2v blender ${basename(pdir)} ${a.id} --as=${name} --params='${JSON.stringify(a.opts.params)}'`); continue; }
    const have = a.meta?.kind === 'video' ? existsSync(join(pdir, 'assets', name, 'f00001.jpg')) : existsSync(join(pdir, 'assets', name));
    if (have) { out.push(`${name}: present`); continue; }
    await fetchAsset(pdir, `${a.source}:${a.id}`, { ...a.opts, as: name, expectSha: a.meta?.kind === 'model' || a.meta?.kind === 'texture' ? undefined : a.sha256 });
    out.push(`${name}: fetched, sha256 verified`);
  }
  writeManifest(pdir, readLock(pdir));
  return out;
}

/** Rewrite assets/assets.js from the lock (after editing the lock by hand, or for layers registered before meta.params existed). */
export function refreshManifest(pdir) {
  const lock = readLock(pdir);
  for (const a of Object.values(lock.assets)) if (a.source === 'blender' && a.meta && !a.meta.params) a.meta.params = a.opts.params;
  writeLock(pdir, lock);
}

export function credits(pdir) {
  const lock = readLock(pdir);
  return Object.entries(lock.assets).map(([n, a]) => `- ${n}: "${a.id}" by ${a.author}, ${a.license}, ${a.page}`).join('\n');
}
export function list(pdir) {
  const lock = readLock(pdir);
  return Object.entries(lock.assets).map(([n, a]) => {
    const m = a.meta || {}, sz = existsSync(join(pdir, 'assets', n)) ? 'present' : 'MISSING (run restore)';
    return `${n.padEnd(14)} ${String(m.kind).padEnd(7)} ${m.kind === 'video' ? `${m.frames} fr @${m.fps} ${m.w}x${m.h}` : m.w ? `${m.w}x${m.h}` : ''}  ${a.license}  ${sz}`;
  }).join('\n');
}
