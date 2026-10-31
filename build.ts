/**
 * Build the miniapp and lay out a static site that the Mentra app can install from.
 *
 *   bun run build.ts
 *
 * Output: site/
 *   miniapp.json          manifest (Mentra reads <url>/miniapp.json)
 *   bundle.zip            installable bundle (Mentra downloads <url>/bundle.zip)
 *   icon.png
 *   dist/background/...   same files unpacked, for "Developer URL" live mode (<url>/dist/...)
 *   dist/ui/...
 *   index.html            short human page with install steps
 *   .nojekyll             tell GitHub Pages to serve files as-is
 */
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "fs"
import {join, resolve} from "path"
import {backgroundRuntimeGuardPlugin} from "./tools/build-helpers"

const root = import.meta.dir
const manifest = JSON.parse(readFileSync(join(root, "miniapp.json"), "utf8"))
const version: string = manifest.version

const VENDOR = join(root, "vendor")
const aliases: Record<string, string> = {
  "@mentra/miniapp/background": join(VENDOR, "mentra-miniapp/src/background/index.ts"),
  "@mentra/miniapp": join(VENDOR, "mentra-miniapp/src/index.ts"),
  eventemitter3: join(VENDOR, "eventemitter3/index.mjs"),
}

const vendorResolver = {
  name: "vendor-resolver",
  setup(build: any) {
    build.onResolve({filter: /^(@mentra\/miniapp(\/background)?|eventemitter3)$/}, (args: any) => ({
      path: aliases[args.path],
    }))
    build.onResolve({filter: /^@mentra\/cloud-protocol\/.+/}, (args: any) => ({
      path: join(VENDOR, "mentra-cloud-protocol/src", args.path.replace("@mentra/cloud-protocol/", "") + ".ts"),
    }))
  },
}

const dist = join(root, "dist")
const site = join(root, "site")
rmSync(dist, {recursive: true, force: true})
rmSync(site, {recursive: true, force: true})

const bg = await Bun.build({
  entrypoints: [join(root, "src/background/index.ts")],
  outdir: join(dist, "background"),
  target: "browser",
  format: "iife",
  minify: false,
  plugins: [vendorResolver, backgroundRuntimeGuardPlugin(import.meta.url)],
  define: {"process.env.NODE_ENV": '"production"'},
})
if (!bg.success) {
  for (const l of bg.logs) console.error(l)
  process.exit(1)
}
// replace the version placeholder string literal
const bgPath = join(dist, "background/index.js")
writeFileSync(bgPath, readFileSync(bgPath, "utf8").replace(/__APP_VERSION__/g, version))

const ui = await Bun.build({
  entrypoints: [join(root, "src/ui/index.html")],
  outdir: join(dist, "ui"),
  target: "browser",
  minify: true,
  plugins: [vendorResolver],
})
if (!ui.success) {
  for (const l of ui.logs) console.error(l)
  process.exit(1)
}

// Bundle layout expected by the Mentra app: miniapp.json at the zip root.
cpSync(join(root, "miniapp.json"), join(dist, "miniapp.json"))
cpSync(join(root, "icon.png"), join(dist, "icon.png"))

mkdirSync(site, {recursive: true})
const zip = Bun.spawnSync(["zip", "-r", "-X", "-q", join(site, "bundle.zip"), "."], {cwd: dist})
if (zip.exitCode !== 0) {
  console.error(zip.stderr.toString())
  process.exit(1)
}
cpSync(join(root, "miniapp.json"), join(site, "miniapp.json"))
cpSync(join(root, "icon.png"), join(site, "icon.png"))
cpSync(dist, join(site, "dist"), {recursive: true})
writeFileSync(join(site, ".nojekyll"), "")
if (existsSync(join(root, "site-index.html"))) cpSync(join(root, "site-index.html"), join(site, "index.html"))
cpSync(join(VENDOR, "qrcode-generator/qrcode.js"), join(site, "qrcode.js"))

const kb = (p: string) => Math.round(readFileSync(p).length / 1024)
console.log(`✓ background ${kb(bgPath)} KB, bundle.zip ${kb(join(site, "bundle.zip"))} KB → ${resolve(site)}`)
