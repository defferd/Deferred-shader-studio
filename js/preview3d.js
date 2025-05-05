class Preview3D {
    constructor(editor) {
        this.editor = editor;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.blockMesh = null;
        this.isRotating = false;
        this.rotationSpeed = 0.01;
        
        this.init();
    }

    init() {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);
        
        // Set up camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.getAspectRatio(), 
            0.1, 
            1000
        );
        this.camera.position.z = 5;
        
        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.updateRendererSize();
        document.getElementById('preview-container').appendChild(this.renderer.domElement);
        
        // Add lights
        this.addLights();
        
        // Load default block
        this.loadBlock('stone');
        
        // Start animation loop
        this.animate();
        
        // Set up controls
        this.initControls();
    }

    getAspectRatio() {
        const container = document.getElementById('preview-container');
        return container.clientWidth / container.clientHeight;
    }

    updateRendererSize() {
        const container = document.getElementById('preview-container');
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.camera.aspect = this.getAspectRatio();
        this.camera.updateProjectionMatrix();
    }

    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Hemisphere light for more natural illumination
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        this.scene.add(hemisphereLight);
    }

    loadBlock(blockType) {
        // Remove existing block if present
        if (this.blockMesh) {
            this.scene.remove(this.blockMesh);
        }
        
        // Create geometry - using a cube for simplicity
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        
        // Create PBR material
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: this.getMetallicValue(),
            roughness: this.getRoughnessValue(),
            map: this.createTexture(`${blockType}_base`),
            normalMap: this.createTexture(`${blockType}_normal`),
            metalnessMap: this.createTexture(`${blockType}_metallic`),
            roughnessMap: this.createTexture(`${blockType}_roughness`),
            aoMap: this.createTexture(`${blockType}_ao`)
        });
        
        this.blockMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.blockMesh);
    }

    createTexture(textureName) {
        // In a real implementation, you'd load the actual texture
        // For now, we'll create a placeholder
        return new THREE.TextureLoader().load(`textures/${textureName}.png`);
    }

    getMetallicValue() {
        const control = document.querySelector('#metallic-control input');
        return control ? parseInt(control.value) / 100 : 0.5;
    }

    getRoughnessValue() {
        const control = document.querySelector('#roughness-control input');
        return control ? parseInt(control.value) / 100 : 0.5;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isRotating && this.blockMesh) {
            this.blockMesh.rotation.x += this.rotationSpeed;
            this.blockMesh.rotation.y += this.rotationSpeed;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    initControls() {
        // Block selector
        document.getElementById('block-selector').addEventListener('change', (e) => {
            this.loadBlock(e.target.value);
        });
        
        // Rotation toggle
        document.getElementById('rotate-toggle').addEventListener('click', () => {
            this.isRotating = !this.isRotating;
        });
        
        // Reset view
        document.getElementById('reset-view').addEventListener('click', () => {
            if (this.blockMesh) {
                this.blockMesh.rotation.set(0, 0, 0);
            }
            this.camera.position.z = 5;
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.updateRendererSize();
        });
    }

    updateTexture(channel, imageData) {
        // This would update the 3D preview when textures are modified
        if (this.blockMesh) {
            const material = this.blockMesh.material;
            
            switch (channel) {
                case 'base':
                    if (material.map) {
                        this.updateThreeJsTexture(material.map, imageData);
                    }
                    break;
                case 'normal':
                    if (material.normalMap) {
                        this.updateThreeJsTexture(material.normalMap, imageData);
                    }
                    break;
                case 'metallic':
                    if (material.metalnessMap) {
                        this.updateThreeJsTexture(material.metalnessMap, imageData);
                    }
                    material.metalness = this.getMetallicValue();
                    break;
                case 'roughness':
                    if (material.roughnessMap) {
                        this.updateThreeJsTexture(material.roughnessMap, imageData);
                    }
                    material.roughness = this.getRoughnessValue();
                    break;
                case 'ao':
                    if (material.aoMap) {
                        this.updateThreeJsTexture(material.aoMap, imageData);
                    }
                    break;
            }
            
            material.needsUpdate = true;
        }
    }

    updateThreeJsTexture(texture, imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        texture.image = canvas;
        texture.needsUpdate = true;
    }
}