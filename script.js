// Main Application Class
class MinecraftShaderPreview {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.gl = null;
        this.shaderProgram = null;
        this.sceneObjects = [];
        this.torches = [];
        this.sunDirection = [0.5, 0.7, 0.5];
        this.time = 0;
        this.aspectRatio = 1;
        this.blockTextures = {};
        this.sunTexture = null;
        this.cloudTexture = null;
        
        this.init();
    }

    // Initialize the application
    async init() {
        try {
            this.setupCanvas();
            this.initWebGL();
            await this.loadTextures();
            this.createScene();
            this.setupControls();
            this.startRendering();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError(`Initialization failed: ${error.message}`);
        }
    }

    // Setup canvas dimensions
    setupCanvas() {
        const container = document.querySelector('.preview-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.aspectRatio = this.canvas.width / this.canvas.height;
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const container = document.querySelector('.preview-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.aspectRatio = this.canvas.width / this.canvas.height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    // Initialize WebGL context
    initWebGL() {
        this.gl = this.canvas.getContext('webgl2', {
            antialias: false,
            depth: true,
            alpha: false
        });

        if (!this.gl) {
            throw new Error('WebGL2 is not supported in your browser');
        }

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
    }

    // Load shaders and create program
    initShaders() {
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
        
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
        
        this.shaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.shaderProgram, vertexShader);
        this.gl.attachShader(this.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.shaderProgram);
        
        if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(this.shaderProgram);
            this.gl.deleteProgram(this.shaderProgram);
            throw new Error(`Shader program linking failed: ${error}`);
        }
        
        this.gl.useProgram(this.shaderProgram);
   // Store attribute and uniform locations
        this.shaderProgram.attribs = {
            position: this.gl.getAttribLocation(this.shaderProgram, 'aPosition'),
            texCoord: this.gl.getAttribLocation(this.shaderProgram, 'aTexCoord'),
            normal: this.gl.getAttribLocation(this.shaderProgram, 'aNormal')
        };
        
        this.shaderProgram.uniforms = {
            projectionMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
            normalMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uNormalMatrix'),
            texture: this.gl.getUniformLocation(this.shaderProgram, 'uTexture'),
            dirLightDirection: this.gl.getUniformLocation(this.shaderProgram, 'uDirLightDirection'),
            dirLightColor: this.gl.getUniformLocation(this.shaderProgram, 'uDirLightColor'),
            dirLightIntensity: this.gl.getUniformLocation(this.shaderProgram, 'uDirLightIntensity'),
            ambientColor: this.gl.getUniformLocation(this.shaderProgram, 'uAmbientColor'),
            ambientIntensity: this.gl.getUniformLocation(this.shaderProgram, 'uAmbientIntensity'),
            pointLights: this.gl.getUniformLocation(this.shaderProgram, 'uPointLights'),
            pointLightColors: this.gl.getUniformLocation(this.shaderProgram, 'uPointLightColors'),
            pointLightIntensities: this.gl.getUniformLocation(this.shaderProgram, 'uPointLightIntensities'),
            pointLightRadii: this.gl.getUniformLocation(this.shaderProgram, 'uPointLightRadii'),
            pointLightCount: this.gl.getUniformLocation(this.shaderProgram, 'uPointLightCount'),
            skyBrightness: this.gl.getUniformLocation(this.shaderProgram, 'uSkyBrightness'),
            cloudsOpacity: this.gl.getUniformLocation(this.shaderProgram, 'uCloudsOpacity')
        };
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compilation failed: ${error}`);
        }
        
        return shader;
    }

    // Load textures
    async loadTextures() {
        try {
            // In a real implementation, you would load actual textures here
            this.blockTextures.grass = this.createPlaceholderTexture([34, 139, 34]);
            this.blockTextures.dirt = this.createPlaceholderTexture([101, 67, 33]);
            this.blockTextures.stone = this.createPlaceholderTexture([128, 128, 128]);
            this.blockTextures.log = this.createPlaceholderTexture([102, 76, 51]);
            this.blockTextures.leaves = this.createPlaceholderTexture([50, 205, 50]);
            
            this.sunTexture = this.createSunTexture();
            this.cloudTexture = this.createCloudTexture();
            
            // Initialize shaders after textures are loaded
            this.initShaders();
        } catch (error) {
            throw new Error(`Texture loading failed: ${error.message}`);
        }
    }

    createPlaceholderTexture(color) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        const pixel = new Uint8Array([color[0], color[1], color[2], 255]);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
        
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        
        return texture;
    }

    createSunTexture() {
        const size = 64;
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        const pixels = new Uint8Array(size * size * 4);
        const center = size / 2;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
                const intensity = Math.max(0, 1 - dist / center);
                
                pixels[idx] = 255;
                pixels[idx+1] = 255;
                pixels[idx+2] = 200;
                pixels[idx+3] = Math.floor(intensity * 255);
            }
        }
        
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, size, size, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        return texture;
    }

    createCloudTexture() {
        const size = 128;
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        const pixels = new Uint8Array(size * size * 4);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const noise = Math.random() * 0.5 + 0.5;
                
                pixels[idx] = 255;
                pixels[idx+1] = 255;
                pixels[idx+2] = 255;
                pixels[idx+3] = Math.floor(noise * 255);
            }
        }
        
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, size, size, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        return texture;
    }

    // Create scene geometry
    createScene() {
        this.createGround();
        this.createCube(0, 1, 0, 'grass');
        this.createCube(1, 1, 0, 'dirt');
        this.createCube(0, 1, 1, 'stone');
        this.createCube(-1, 1, 0, 'log');
        this.createCube(0, 2, 0, 'leaves');
        
        // Add initial torches
        this.addTorch(2, 1.5, 0);
        this.addTorch(-2, 1.5, 0);
        this.addTorch(0, 1.5, 2);
    }

    createGround() {
        const size = 10;
        const vertices = [
            // Positions         // Texture coords  // Normals
            -size, 0, -size,     0, 0,             0, 1, 0,
            size, 0, -size,      size, 0,          0, 1, 0,
            size, 0, size,       size, size,       0, 1, 0,
            -size, 0, size,      0, size,         0, 1, 0
        ];
        
        const indices = [0, 1, 2, 0, 2, 3];
        
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

           this.sceneObjects.push({
            vertexBuffer: vertexBuffer,
            indexBuffer: indexBuffer,
            vertexCount: indices.length,
            texture: this.blockTextures.grass,
            modelMatrix: mat4.create(),
            type: 'ground'
        });
    }

    createCube(x, y, z, textureKey) {
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
        
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
        
        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [x, y, z]);
        
        this.sceneObjects.push({
            vertexBuffer: vertexBuffer,
            indexBuffer: indexBuffer,
            vertexCount: indices.length,
            texture: this.blockTextures[textureKey],
            modelMatrix: modelMatrix,
            type: 'cube'
        });
    }

    addTorch(x, y, z) {
        if (this.torches.length >= 10) {
            console.warn('Maximum number of torches reached (10)');
            return;
        }
        
        this.torches.push({
            position: [x, y, z],
            color: [1.0, 0.6, 0.2] // Orange torch light
        });
    }

    // Setup UI controls
    setupControls() {
        // Directional light controls
        document.getElementById('dirLightAzimuth').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('dirLightAzimuthValue').textContent = value + '°';
            this.updateSunDirection();
        });
        
        document.getElementById('dirLightElevation').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('dirLightElevationValue').textContent = value + '°';
            this.updateSunDirection();
        });
        
        // Point light (torch) controls
        document.getElementById('addTorch').addEventListener('click', () => {
            const x = (Math.random() - 0.5) * 4;
            const z = (Math.random() - 0.5) * 4;
            this.addTorch(x, 1.5, z);
        });
        
        document.getElementById('removeTorch').addEventListener('click', () => {
            if (this.torches.length > 0) {
                this.torches.pop();
            }
        });
    }

    updateSunDirection() {
        const azimuth = document.getElementById('dirLightAzimuth').value * Math.PI / 180;
        const elevation = document.getElementById('dirLightElevation').value * Math.PI / 180;
        
        this.sunDirection = [
            Math.cos(elevation) * Math.sin(azimuth),
            Math.sin(elevation),
            Math.cos(elevation) * Math.cos(azimuth)
        ];
    }

    // Start the rendering loop
    startRendering() {
        const renderLoop = (now) => {
            this.time = now * 0.001;
            this.render();
            requestAnimationFrame(renderLoop);
        };
        requestAnimationFrame(renderLoop);
    }

    // Main render function
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Set up projection matrix
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, this.aspectRatio, 0.1, 100.0);
        
        // Set up view matrix (camera)
        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 2, -8]);
        mat4.rotateY(viewMatrix, viewMatrix, this.time * 0.1);
        mat4.rotateX(viewMatrix, viewMatrix, -0.5);
        
        // Set shader uniforms that don't change per object
        this.gl.uniformMatrix4fv(this.shaderProgram.uniforms.projectionMatrix, false, projectionMatrix);
        
        // Get control values
        const dirLightIntensity = parseFloat(document.getElementById('dirLightIntensity').value);
        const dirLightColor = this.hexToRgb(document.getElementById('dirLightColor').value);
        
        const ambientIntensity = parseFloat(document.getElementById('ambientIntensity').value);
        const ambientColor = this.hexToRgb(document.getElementById('ambientColor').value);
        
        const pointLightIntensity = parseFloat(document.getElementById('pointLightIntensity').value);
        const pointLightRadius = parseFloat(document.getElementById('pointLightRadius').value);
        
        // Set light uniforms
        this.gl.uniform3fv(this.shaderProgram.uniforms.dirLightDirection, this.sunDirection);
        this.gl.uniform3fv(this.shaderProgram.uniforms.dirLightColor, dirLightColor);
        this.gl.uniform1f(this.shaderProgram.uniforms.dirLightIntensity, dirLightIntensity);
        
        this.gl.uniform3fv(this.shaderProgram.uniforms.ambientColor, ambientColor);
        this.gl.uniform1f(this.shaderProgram.uniforms.ambientIntensity, ambientIntensity);
        
        // Prepare point light data
        const pointLightPositions = [];
        const pointLightColors = [];
        const pointLightIntensities = [];
        const pointLightRadii = [];
        
        for (const torch of this.torches) {
            pointLightPositions.push(...torch.position);
            pointLightColors.push(...torch.color);
            pointLightIntensities.push(pointLightIntensity);
            pointLightRadii.push(pointLightRadius);
        }
        
        this.gl.uniform3fv(this.shaderProgram.uniforms.pointLights, pointLightPositions);
        this.gl.uniform3fv(this.shaderProgram.uniforms.pointLightColors, pointLightColors);
        this.gl.uniform1fv(this.shaderProgram.uniforms.pointLightIntensities, pointLightIntensities);
        this.gl.uniform1fv(this.shaderProgram.uniforms.pointLightRadii, pointLightRadii);
        this.gl.uniform1i(this.shaderProgram.uniforms.pointLightCount, this.torches.length);
        
        // Render all objects
        for (const obj of this.sceneObjects) {
            // Calculate model-view matrix
            const modelViewMatrix = mat4.create();
            mat4.copy(modelViewMatrix, viewMatrix);
            mat4.multiply(modelViewMatrix, modelViewMatrix, obj.modelMatrix);
            
            // Calculate normal matrix
            const normalMatrix = mat3.create();
            mat3.normalFromMat4(normalMatrix, modelViewMatrix);
            
            // Set object-specific uniforms
            this.gl.uniformMatrix4fv(this.shaderProgram.uniforms.modelViewMatrix, false, modelViewMatrix);
            this.gl.uniformMatrix3fv(this.shaderProgram.uniforms.normalMatrix, false, normalMatrix);
            
            // Bind texture
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, obj.texture);
            this.gl.uniform1i(this.shaderProgram.uniforms.texture, 0);
            
            // Bind vertex buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, obj.vertexBuffer);
            
            // Set up attribute pointers
            this.gl.vertexAttribPointer(this.shaderProgram.attribs.position, 3, this.gl.FLOAT, false, 8 * 4, 0);
            this.gl.enableVertexAttribArray(this.shaderProgram.attribs.position);
            
            this.gl.vertexAttribPointer(this.shaderProgram.attribs.texCoord, 2, this.gl.FLOAT, false, 8 * 4, 3 * 4);
            this.gl.enableVertexAttribArray(this.shaderProgram.attribs.texCoord);
            
            this.gl.vertexAttribPointer(this.shaderProgram.attribs.normal, 3, this.gl.FLOAT, false, 8 * 4, 5 * 4);
            this.gl.enableVertexAttribArray(this.shaderProgram.attribs.normal);
            
            // Bind index buffer and draw
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
            this.gl.drawElements(this.gl.TRIANGLES, obj.vertexCount, this.gl.UNSIGNED_SHORT, 0);
        }
    }

    hexToRgb(hex) {
        const r = parseInt(hex.substring(1, 3), 16) / 255;
        const g = parseInt(hex.substring(3, 5), 16) / 255;
        const b = parseInt(hex.substring(5, 7), 16) / 255;
        return [r, g, b];
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.querySelector('.preview-container').appendChild(errorDiv);
    }
}

// Start the application when the page loads
window.addEventListener('load', () => {
    new MinecraftShaderPreview();
});
