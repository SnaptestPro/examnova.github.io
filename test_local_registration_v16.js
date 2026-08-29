// Sanity test for v16 local paper-registration correction.
// Not a full re-implementation of exam-manager.js — just proves the core
// idea (findBlackSquare + IDW offset field) behaves as intended on a
// synthetic "warped but slightly locally shifted" grayscale image.

function makeCanvasLike(w, h) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return {
    width: w, height: h, _data: data,
    getContext() {
      return {
        getImageData(x, y, ww, hh) {
          const out = new Uint8ClampedArray(ww * hh * 4);
          for (let yy = 0; yy < hh; yy++) {
            for (let xx = 0; xx < ww; xx++) {
              const sx = x + xx, sy = y + yy;
              const di = (yy * ww + xx) * 4;
              if (sx < 0 || sy < 0 || sx >= w || sy >= h) { out[di]=out[di+1]=out[di+2]=255; out[di+3]=255; continue; }
              const si = (sy * w + sx) * 4;
              out[di]=data[si]; out[di+1]=data[si+1]; out[di+2]=data[si+2]; out[di+3]=data[si+3];
            }
          }
          return { data: out };
        }
      };
    }
  };
}
function fillSquare(canvas, cx, cy, size) {
  const { width: w, _data: data } = canvas;
  const half = size / 2;
  for (let y = Math.round(cy - half); y < Math.round(cy + half); y++) {
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
      const i = (y * w + x) * 4;
      data[i] = data[i+1] = data[i+2] = 0;
    }
  }
}

// Re-declare the minimal pieces under test (mirrors exam-manager.js logic)
function findBlackSquareMini(context, region, canvasWidth, canvasHeight) {
  const x = Math.max(0, Math.min(canvasWidth - 1, region.x));
  const y = Math.max(0, Math.min(canvasHeight - 1, region.y));
  const width = Math.max(1, Math.min(canvasWidth - x, region.width));
  const height = Math.max(1, Math.min(canvasHeight - y, region.height));
  const pixels = context.getImageData(x, y, width, height).data;
  const count = width * height;
  const dark = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const b = pixels[o]*0.2126 + pixels[o+1]*0.7152 + pixels[o+2]*0.0722;
    if (b < 68) dark[i] = 1;
  }
  let minX=width,maxX=0,minY=height,maxY=0,pixelCount=0;
  for (let yy=0; yy<height; yy++) for (let xx=0; xx<width; xx++) {
    if (dark[yy*width+xx]) { pixelCount++; minX=Math.min(minX,xx); maxX=Math.max(maxX,xx); minY=Math.min(minY,yy); maxY=Math.max(maxY,yy); }
  }
  if (!pixelCount) return null;
  return { x: x + (minX+maxX)/2, y: y + (minY+maxY)/2 };
}

function findLocalMarkerOffset(ctx, ex, ey, w, h) {
  const winHalf = 26;
  const found = findBlackSquareMini(ctx, { x: ex-winHalf, y: ey-winHalf, width: winHalf*2, height: winHalf*2 }, w, h);
  if (!found) return null;
  const dx = found.x - ex, dy = found.y - ey;
  if (Math.abs(dx) > 18 || Math.abs(dy) > 18) return null;
  return { ax: found.x, ay: found.y, ex, ey, dx, dy };
}

function buildField(points) {
  return {
    at(x, y) {
      let wSum=0,dxSum=0,dySum=0;
      for (const p of points) {
        const ddx=x-p.ex, ddy=y-p.ey, d2=ddx*ddx+ddy*ddy;
        if (d2<1) return { dx:p.dx, dy:p.dy };
        const wgt=1/d2; wSum+=wgt; dxSum+=p.dx*wgt; dySum+=p.dy*wgt;
      }
      return wSum ? { dx: dxSum/wSum, dy: dySum/wSum } : { dx:0, dy:0 };
    }
  };
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log("  ok -", name); } else { fail++; console.log("  FAIL -", name); } }

// Scenario: a marker grid where the BOTTOM HALF of the sheet is shifted
// +6px down/right of its template position (simulating a crease letting
// the lower half of the paper sag away from the flat 4-corner warp).
const W = 400, H = 600;
const templatePts = [];
for (let y = 50; y <= 550; y += 100) for (let x = 50; x <= 350; x += 100) templatePts.push({ x, y });

const canvas = makeCanvasLike(W, H);
templatePts.forEach(p => {
  const shift = p.y > 300 ? 6 : 0;
  fillSquare(canvas, p.x + shift, p.y + shift, 16);
});
const ctx = canvas.getContext();

const found = [];
templatePts.forEach(p => {
  const off = findLocalMarkerOffset(ctx, p.x, p.y, W, H);
  if (off) found.push(off);
});
check("found markers across the whole grid", found.length === templatePts.length);

const field = buildField(found);
const topOffset = field.at(200, 60);
const bottomOffset = field.at(200, 540);
check("top-half offset reads ~0 (unshifted region)", Math.abs(topOffset.dx) < 1 && Math.abs(topOffset.dy) < 1);
check("bottom-half offset reads ~+6 (matches the injected shift)", Math.abs(bottomOffset.dx - 6) < 1.5 && Math.abs(bottomOffset.dy - 6) < 1.5);

// A bubble near the crease boundary should read an in-between correction,
// not a hard jump — this is the whole point vs. a single global number.
const midOffset = field.at(200, 300);
check("mid-sheet (near the simulated crease) reads a partial, in-between correction", midOffset.dy > 1 && midOffset.dy < 5.5);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
