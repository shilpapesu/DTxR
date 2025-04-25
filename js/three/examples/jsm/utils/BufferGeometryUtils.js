import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, TrianglesDrawMode } from 'three';

/**
 * Converts a buffer geometry's draw mode to triangles.
 * @param {BufferGeometry} geometry - The geometry to convert
 * @param {number} drawMode - The current draw mode of the geometry
 * @returns {BufferGeometry} The converted geometry
 */
export function toTrianglesDrawMode(geometry, drawMode) {
    if (drawMode === TrianglesDrawMode) {
        return geometry;
    }

    const geom = geometry.clone();
    const index = geom.getIndex();
    
    if (!index) {
        const positions = geom.getAttribute('position');
        const vertexCount = positions.count;
        const indexBuffer = vertexCount > 65535
            ? new Uint32Array(vertexCount)
            : new Uint16Array(vertexCount);
            
        for (let i = 0; i < vertexCount; i++) {
            indexBuffer[i] = i;
        }
        
        geom.setIndex(new (vertexCount > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute)(indexBuffer, 1));
    }

    return geom;
}

// Export an empty object for any other imports
export default {}; 