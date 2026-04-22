export interface MeshData {
    pixels: Uint8Array;
    numTris: number;
    texWidth: number;
    texHeight: number;
    meshMin: [number, number, number];
    meshRange: number;
    name: string;
}

// Fixed texture width; height grows with tri count.
// Inject #define MESH_WIDTH 1024 into shaders alongside #define MAX_TRIS N.
const MESH_WIDTH = 1024;

export function loadOBJ(text: string, name: string): MeshData | string {
    const verts: [number, number, number][] = [];
    const tris: [number, number, number][] = [];

    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line[0] === "#") continue;
        const parts = line.split(/\s+/);
        if (parts[0] === "v") {
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
            verts.push([x, y, z]);
        } else if (parts[0] === "f") {
            const indices = parts
                .slice(1)
                .map((p) => parseInt(p.split("/")[0], 10) - 1);
            // Fan triangulation for quads / n-gons
            for (let i = 1; i < indices.length - 1; i++) {
                tris.push([indices[0], indices[i], indices[i + 1]]);
            }
        }
    }

    if (verts.length === 0) return "No vertices found in OBJ file.";
    if (tris.length === 0) return "No faces found in OBJ file.";

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of verts) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const meshRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if (meshRange === 0) return "Degenerate mesh (zero bounding box).";

    const meshMin: [number, number, number] = [minX, minY, minZ];
    const numTris = tris.length;
    const numPixels = numTris * 3;
    const texWidth = MESH_WIDTH;
    const texHeight = Math.max(1, Math.ceil(numPixels / MESH_WIDTH));
    const pixels = new Uint8Array(texWidth * texHeight * 4);

    for (let i = 0; i < numTris; i++) {
        for (let j = 0; j < 3; j++) {
            const vi = tris[i][j];
            if (vi < 0 || vi >= verts.length) continue;
            const [x, y, z] = verts[vi];
            const flat = i * 3 + j;
            const base = flat * 4;
            pixels[base + 0] = Math.round(((x - minX) / meshRange) * 255);
            pixels[base + 1] = Math.round(((y - minY) / meshRange) * 255);
            pixels[base + 2] = Math.round(((z - minZ) / meshRange) * 255);
            pixels[base + 3] = 255;
        }
    }

    return { pixels, numTris, texWidth, texHeight, meshMin, meshRange, name };
}
