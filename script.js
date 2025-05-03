// Main variables
let canvas, gl;
let shaderProgram;
let sceneObjects = [];
let torches = [];
let sunDirection = [0.5, 0.7, 0.5];
let time = 0;

// Texture variables
let blockTextures = {};
let sunTexture, cloudTexture;

// Initialize the application
window.onload = function() {
    // Setup canvas and WebGL context
    canvas = document.getElementById('previewCanvas');
    gl = canvas.getContext('webgl2');
    
    if (!gl) {
        alert('WebGL2 not supported in your browser!');
        return;
    }
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize WebGL
    initWebGL();
    
    // Load textures
    loadTextures().then(() => {
        // Create scene objects
        createScene();
        
        // Setup event listeners for controls
        setupControls();
        
        // Start rendering
        requestAnimationFrame(render);
    });
};

function resizeCanvas() {
    const container = document.querySelector('.preview-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function initWebGL() {
    // Vertex shader source
    const vsSource = `#version 300 es
        in vec3 aPosition;
        in vec2 aTexCoord;
        in vec3 aNormal;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat3 uNormalMatrix;
        
        out vec2 vTexCoord;
        out vec3 vNormal;
        out vec3 vPosition;
        
        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            vTexCoord = aTexCoord;
            vNormal = uNormalMatrix * aNormal;
            vPosition = vec3(uModelViewMatrix * vec4(aPosition, 1.0));
        }
    `;
    
    // Fragment shader source (simplified deferred shading)
    const fsSource = `#version 300 es
        precision highp float;
        
        in vec2 vTexCoord;
        in vec3 vNormal;
        in vec3 vPosition;
        
        uniform sampler2D uTexture;
        uniform vec3 uDirLightDirection;
        uniform vec3 uDirLightColor;
        uniform float uDirLightIntensity;
        
        uniform vec3 uAmbientColor;
        uniform float uAmbientIntensity;
        
        uniform vec3 uPointLights[10];
        uniform vec3 uPointLightColors[10];
        uniform float uPointLightIntensities[10];
        uniform float uPointLightRadii[10];
        uniform int uPointLightCount;
        
        uniform float uSkyBrightness;
        uniform float uCloudsOpacity;
        
        out vec4 fragColor;
        
        void main() {
            // Sample texture
            vec4 texColor = texture(uTexture, vTexCoord);
            
            // Normalize normal
            vec3 normal = normalize(vNormal);
            
            // Directional light calculation
            float dirDiffuse = max(dot(normal, normalize(-uDirLightDirection)), 0.0);
            vec3 dirLight = dirDiffuse * uDirLightColor * uDirLightIntensity;
            
            // Ambient light
            vec3 ambient = uAmbientColor * uAmbientIntensity;
            
            // Point lights (torches)
            vec3 pointLights = vec3(0.0);
            for (int i = 0; i < uPointLightCount; i++) {
                vec3 lightDir = uPointLights[i] - vPosition;
                float distance = length(lightDir);
                lightDir = normalize(lightDir);
                
                // Attenuation
                float attenuation = 1.0 / (1.0 + 0.1 * distance + 0.01 * distance * distance);
                attenuation *= smoothstep(uPointLightRadii[i], 0.0, distance);
                
                // Diffuse
                float diff = max(dot(normal, lightDir), 0.0);
                pointLights += diff * uPointLightColors[i] * uPointLightIntensities[i] * attenuation;
            }
            
            // Combine all lights
            vec3 lighting = ambient + dirLight + pointLights;
            
            // Final color with gamma correction
            vec3 finalColor = texColor.rgb * lighting;
            finalColor = pow(finalColor, vec3(1.0/2.2));
            
            fragColor = vec4(finalColor, texColor.a);
        }
    `;
    
    // Compile shaders
    const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
    
    // Create shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Shader program linking error:', gl.getProgramInfoLog(shaderProgram));
        return;
    }
    
    gl.useProgram(shaderProgram);
    
    // Get attribute and uniform locations
    shaderProgram.attribLocations = {
        position: gl.getAttribLocation(shaderProgram, 'aPosition'),
        texCoord: gl.getAttribLocation(shaderProgram, 'aTexCoord'),
        normal: gl.getAttribLocation(shaderProgram, 'aNormal')
    };
    
    shaderProgram.uniformLocations = {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
        texture: gl.getUniformLocation(shaderProgram, 'uTexture'),
        dirLightDirection: gl.getUniformLocation(shaderProgram, 'uDirLightDirection'),
        dirLightColor: gl.getUniformLocation(shaderProgram, 'uDirLightColor'),
        dirLightIntensity: gl.getUniformLocation(shaderProgram, 'uDirLightIntensity'),
        ambientColor: gl.getUniformLocation(shaderProgram, 'uAmbientColor'),
        ambientIntensity: gl.getUniformLocation(shaderProgram, 'uAmbientIntensity'),
        pointLights: gl.getUniformLocation(shaderProgram, 'uPointLights'),
        pointLightColors: gl.getUniformLocation(shaderProgram, 'uPointLightColors'),
        pointLightIntensities: gl.getUniformLocation(shaderProgram, 'uPointLightIntensities'),
        pointLightRadii: gl.getUniformLocation(shaderProgram, 'uPointLightRadii'),
        pointLightCount: gl.getUniformLocation(shaderProgram, 'uPointLightCount'),
        skyBrightness: gl.getUniformLocation(shaderProgram, 'uSkyBrightness'),
        cloudsOpacity: gl.getUniformLocation(shaderProgram, 'uCloudsOpacity')
    };
}

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

async function loadTextures() {
    // In a real implementation, you would load actual Minecraft textures here
    // For this example, we'll create placeholder textures
    
    // Create placeholder textures
    blockTextures.grass = createPlaceholderTexture([34, 139, 34]); // Green
    blockTextures.dirt = createPlaceholderTexture([101, 67, 33]); // Brown
    blockTextures.stone = createPlaceholderTexture([128, 128, 128]); // Gray
    blockTextures.log = createPlaceholderTexture([102, 76, 51]); // Wood
    blockTextures.leaves = createPlaceholderTexture([50, 205, 50]); // Light green
    
    // Sun texture (simple gradient)
    sunTexture = createSunTexture();
    
    // Cloud texture (simple noise pattern)
    cloudTexture = createCloudTexture();
}

function createPlaceholderTexture(color) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    const pixel = new Uint8Array([color[0], color[1], color[2], 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    return texture;
}

function createSunTexture() {
    const size = 64;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    const pixels = new Uint8Array(size * size * 4);
    const center = size / 2;
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
            const intensity = Math.max(0, 1 - dist / center);
            
            pixels[idx] = 255; // R
            pixels[idx+1] = 255; // G
            pixels[idx+2] = 200; // B
            pixels[idx+3] = Math.floor(intensity * 255); // A
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    
    return texture;
}

function createCloudTexture() {
    const size = 128;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    const pixels = new Uint8Array(size * size * 4);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const noise = Math.random() * 0.5 + 0.5;
            
            pixels[idx] = 255; // R
            pixels[idx+1] = 255; // G
            pixels[idx+2] = 255; // B
            pixels[idx+3] = Math.floor(noise * 255); // A
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    
    return texture;
}

function createScene() {
    // Create a simple Minecraft-like scene with blocks
    createGround();
    createCube(0, 1, 0, 'grass');
    createCube(1, 1, 0, 'dirt');
    createCube(0, 1, 1, 'stone');
    createCube(-1, 1, 0, 'log');
    createCube(0, 2, 0, 'leaves');
    
    // Add some initial torches
    addTorch(2, 1.5, 0);
    addTorch(-2, 1.5, 0);
    addTorch(0, 1.5, 2);
}

function createGround() {
    const size = 10;
    const vertices = [
        // Positions         // Texture coords  // Normals
        -size, 0, -size,     0, 0,             0, 1, 0,
        size, 0, -size,      size, 0,          0, 1, 0,
        size, 0, size,       size, size,       0, 1, 0,
        -size, 0, size,      0, size,         0, 1, 0
    ];
    
    const indices = [0, 1, 2, 0, 2, 3];
    
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    sceneObjects.push({
        vertexBuffer: vertexBuffer,
        indexBuffer: indexBuffer,
        vertexCount: indices.length,
        texture: blockTextures.grass,
        modelMatrix: mat4.create(),
        type: 'ground'
    });
}

function createCube(x, y, z, textureKey) {
    // Cube vertices with positions, texture coordinates, and normals
    const vertices = [
        // Front face
        -0.5, -0.5,  0.5,  0, 0,  0, 0, 1,
         0.5, -0.5,  0.5,  1, 0,  0, 0, 1,
         0.5,  0.5,  0.5,  1, 1,  0, 0, 1,
        -0.5,  0.5,  0.5,  0, 1,  0, 0, 1,
        
        // Back face
        -0.5, -0.5, -0.5,  1, 0,  0, 0, -1,
        -0.5,  0.5, -0.5,  1, 1,  0, 0, -1,
         0.5,  0.5, -0.5,  0, 1,  0, 0, -1,
         0.5, -0.5, -0.5,  0, 0,  0, 0, -1,
        
        // Top face
        -0.5,  0.5, -0.5,  0, 1,  0, 1, 0,
        -0.5,  0.5,  0.5,  0, 0,  0, 1, 0,
         0.5,  0.5,  0.5,  1, 0,  0, 1, 0,
         0.5,  0.5, -0.5,  1, 1,  0, 1, 0,
        
        // Bottom face
        -0.5, -0.5, -0.5,  1, 1,  0, -1, 0,
         0.5, -0.5, -0.5,  0, 1,  0, -1, 0,
         0.5, -0.5,  0.5,  0, 0,  0, -1, 0,
        -0.5, -0.5,  0.5,  1, 0,  0, -1, 0,
        
        // Right face
         0.5, -0.5, -0.5,  1, 0,  1, 0, 0,
         0.5,  0.5, -0.5,  1, 1,  1, 0, 0,
         0.5,  0.5,  0.5,  0, 1,  1, 0, 0,
         0.5, -0.5,  0.5,  0, 0,  1, 0, 0,
        
        // Left face
        -0.5, -0.5, -0.5,  0, 0,  -1, 0, 0,
        -0.5, -0.5,  0.5,  1, 0,  -1, 0, 0,
        -0.5,  0.5,  0.5,  1, 1,  -1, 0, 0,
        -0.5,  0.5, -0.5,  0, 1,  -1, 0, 0
    ];
    
    const indices = [
        0, 1, 2,  0, 2, 3,    // Front
        4, 5, 6,  4, 6, 7,    // Back
        8, 9, 10, 8, 10, 11,  // Top
        12,13,14, 12,14,15,   // Bottom
        16,17,18, 16,18,19,   // Right
        20,21,22, 20,22,23    // Left
    ];
    
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [x, y, z]);
    
    sceneObjects.push({
        vertexBuffer: vertexBuffer,
        indexBuffer: indexBuffer,
        vertexCount: indices.length,
        texture: blockTextures[textureKey],
        modelMatrix: modelMatrix,
        type: 'cube'
    });
}

function addTorch(x, y, z) {
    torches.push({
        position: [x, y, z],
        color: [1.0, 0.6, 0.2] // Orange torch light
    });
}

function setupControls() {
    // Directional light controls
    document.getElementById('dirLightAzimuth').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('dirLightAzimuthValue').textContent = value + '°';
        updateSunDirection();
    });
    
    document.getElementById('dirLightElevation').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('dirLightElevationValue').textContent = value + '°';
        updateSunDirection();
    });
    
    document.getElementById('dirLightIntensity').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('dirLightIntensityValue').textContent = value;
    });
    
    document.getElementById('dirLightColor').addEventListener('input', function(e) {
        // Color is handled in render loop
    });
    
    // Point light (torch) controls
    document.getElementById('pointLightIntensity').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('pointLightIntensityValue').textContent = value;
    });
    
    document.getElementById('pointLightRadius').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('pointLightRadiusValue').textContent = value;
    });
    
    document.getElementById('addTorch').addEventListener('click', function() {
        // Add a torch at a random position near the center
        const x = (Math.random() - 0.5) * 4;
        const z = (Math.random() - 0.5) * 4;
        addTorch(x, 1.5, z);
    });
    
    document.getElementById('removeTorch').addEventListener('click', function() {
        if (torches.length > 0) {
            torches.pop();
        }
    });
    
    // Ambient light controls
    document.getElementById('ambientIntensity').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('ambientIntensityValue').textContent = value;
    });
    
    document.getElementById('ambientColor').addEventListener('input', function(e) {
        // Color is handled in render loop
    });
    
    // Sky controls
    document.getElementById('skyBrightness').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('skyBrightnessValue').textContent = value;
    });
    
    document.getElementById('cloudsOpacity').addEventListener('input', function(e) {
        const value = e.target.value;
        document.getElementById('cloudsOpacityValue').textContent = value;
    });
}

function updateSunDirection() {
    const azimuth = document.getElementById('dirLightAzimuth').value * Math.PI / 180;
    const elevation = document.getElementById('dirLightElevation').value * Math.PI / 180;
    
    sunDirection = [
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth)
    ];
}

function render(now) {
    // Calculate delta time
    time = now * 0.001; // Convert to seconds
    
    // Clear canvas
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    
    // Set up projection matrix
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100.0);
    
    // Set up view matrix (camera)
    const viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, [0, 0, -5]);
    mat4.rotateY(viewMatrix, viewMatrix, time * 0.1);
    
    // Set shader uniforms that don't change per object
    gl.uniformMatrix4fv(shaderProgram.uniformLocations.projectionMatrix, false, projectionMatrix);
    
    // Get control values
    const dirLightIntensity = parseFloat(document.getElementById('dirLightIntensity').value);
    const dirLightColorHex = document.getElementById('dirLightColor').value;
    const dirLightColor = hexToRgb(dirLightColorHex);
    
    const ambientIntensity = parseFloat(document.getElementById('ambientIntensity').value);
    const ambientColorHex = document.getElementById('ambientColor').value;
    const ambientColor = hexToRgb(ambientColorHex);
    
    const pointLightIntensity = parseFloat(document.getElementById('pointLightIntensity').value);
    const pointLightRadius = parseFloat(document.getElementById('pointLightRadius').value);
    
    const skyBrightness = parseFloat(document.getElementById('skyBrightness').value);
    const cloudsOpacity = parseFloat(document.getElementById('cloudsOpacity').value);
    
    // Set light uniforms
    gl.uniform3fv(shaderProgram.uniformLocations.dirLightDirection, sunDirection);
    gl.uniform3fv(shaderProgram.uniformLocations.dirLightColor, dirLightColor);
    gl.uniform1f(shaderProgram.uniformLocations.dirLightIntensity, dirLightIntensity);
    
    gl.uniform3fv(shaderProgram.uniformLocations.ambientColor, ambientColor);
    gl.uniform1f(shaderProgram.uniformLocations.ambientIntensity, ambientIntensity);
    
    // Prepare point light data
    const pointLightPositions = [];
    const pointLightColors = [];
    const pointLightIntensities = [];
    const pointLightRadii = [];
    
    for (const torch of torches) {
        pointLightPositions.push(torch.position[0], torch.position[1], torch.position[2]);
        pointLightColors.push(torch.color[0], torch.color[1], torch.color[2]);
        pointLightIntensities.push(pointLightIntensity);
        pointLightRadii.push(pointLightRadius);
    }
    
    gl.uniform3fv(shaderProgram.uniformLocations.pointLights, pointLightPositions);
    gl.uniform3fv(shaderProgram.uniformLocations.pointLightColors, pointLightColors);
    gl.uniform1fv(shaderProgram.uniformLocations.pointLightIntensities, pointLightIntensities);
    gl.uniform1fv(shaderProgram.uniformLocations.pointLightRadii, pointLightRadii);
    gl.uniform1i(shaderProgram.uniformLocations.pointLightCount, torches.length);
    
    gl.uniform1f(shaderProgram.uniformLocations.skyBrightness, skyBrightness);
    gl.uniform1f(shaderProgram.uniformLocations.ccloudsOpacity, cloudsOpacity);
    
    // Render all objects
    for (const obj of sceneObjects) {
        // Calculate model-view matrix
        const modelViewMatrix = mat4.create();
        mat4.copy(modelViewMatrix, viewMatrix);
        mat4.multiply(modelViewMatrix, modelViewMatrix, obj.modelMatrix);
        
        // Calculate normal matrix
        const normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelViewMatrix);
        
        // Set object-specific uniforms
        gl.uniformMatrix4fv(shaderProgram.uniformLocations.modelViewMatrix, false, modelViewMatrix);
        gl.uniformMatrix3fv(shaderProgram.uniformLocations.normalMatrix, false, normalMatrix);
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        gl.uniform1i(shaderProgram.uniformLocations.texture, 0);
        
        // Bind vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
        
        // Set up attribute pointers
        gl.vertexAttribPointer(shaderProgram.attribLocations.position, 3, gl.FLOAT, false, 8 * 4, 0);
        gl.enableVertexAttribArray(shaderProgram.attribLocations.position);
        
        gl.vertexAttribPointer(shaderProgram.attribLocations.texCoord, 2, gl.FLOAT, false, 8 * 4, 3 * 4);
        gl.enableVertexAttribArray(shaderProgram.attribLocations.texCoord);
        
        gl.vertexAttribPointer(shaderProgram.attribLocations.normal, 3, gl.FLOAT, false, 8 * 4, 5 * 4);
        gl.enableVertexAttribArray(shaderProgram.attribLocations.normal);
        
        // Bind index buffer and draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
        gl.drawElements(gl.TRIANGLES, obj.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
    
    requestAnimationFrame(render);
}

function hexToRgb(hex) {
    // Convert hex color to normalized RGB array
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    return [r, g, b];
}
