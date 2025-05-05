class LayerSystem {
    constructor(editor) {
        this.editor = editor;
        this.layers = [];
        this.activeLayerIndex = 0;
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.layersListElement = document.getElementById('layers-list');
        this.addLayerButton = document.getElementById('add-layer-btn');
        this.deleteLayerButton = document.getElementById('delete-layer-btn');
    }

    initEventListeners() {
        this.addLayerButton.addEventListener('click', () => this.addLayer());
        this.deleteLayerButton.addEventListener('click', () => this.deleteActiveLayer());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                this.addLayer();
                e.preventDefault();
            }
            
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.deleteActiveLayer();
                e.preventDefault();
            }
        });
    }

    addLayer(name = `Layer ${this.layers.length + 1}`) {
        const newLayer = {
            name: name,
            canvas: new fabric.Canvas(null, {
                width: this.editor.state.documentSize.width,
                height: this.editor.state.documentSize.height,
                backgroundColor: 'transparent',
                renderOnAddRemove: false
            }),
            visible: true,
            opacity: 1.0,
            blendMode: 'normal',
            locked: false
        };
        
        this.layers.push(newLayer);
        this.setActiveLayer(this.layers.length - 1);
        this.renderLayersList();
        
        return newLayer;
    }

    deleteActiveLayer() {
        if (this.layers.length <= 1) return; // Don't delete the last layer
        
        this.layers.splice(this.activeLayerIndex, 1);
        
        // Ensure active layer is valid
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        
        this.renderLayersList();
        this.editor.updateCanvas();
    }

    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.renderLayersList();
        }
    }

    getActiveLayer() {
        return this.layers[this.activeLayerIndex];
    }

    renderLayersList() {
        this.layersListElement.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const layerElement = document.createElement('div');
            layerElement.className = 'layer-item';
            if (index === this.activeLayerIndex) layerElement.classList.add('active');
            
            layerElement.innerHTML = `
                <input type="checkbox" ${layer.visible ? 'checked' : ''}>
                <span class="layer-name">${layer.name}</span>
                <div class="layer-controls">
                    <button class="layer-up"><i class="fas fa-arrow-up"></i></button>
                    <button class="layer-down"><i class="fas fa-arrow-down"></i></button>
                </div>
            `;
            
            // Toggle visibility
            const checkbox = layerElement.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                layer.visible = e.target.checked;
                this.editor.updateCanvas();
            });
            
            // Set active layer
            layerElement.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                    this.setActiveLayer(index);
                }
            });
            
            // Layer reordering
            const upButton = layerElement.querySelector('.layer-up');
            const downButton = layerElement.querySelector('.layer-down');
            
            upButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index > 0) {
                    this.moveLayer(index, index - 1);
                }
            });
            
            downButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index < this.layers.length - 1) {
                    this.moveLayer(index, index + 1);
                }
            });
            
            this.layersListElement.appendChild(layerElement);
        });
    }

    moveLayer(fromIndex, toIndex) {
        const layer = this.layers[fromIndex];
        this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, layer);
        
        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (fromIndex < toIndex && this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
            this.activeLayerIndex--;
        } else if (fromIndex > toIndex && this.activeLayerIndex >= toIndex && this.activeLayerIndex < fromIndex) {
            this.activeLayerIndex++;
        }
        
        this.renderLayersList();
        this.editor.updateCanvas();
    }

    renderAllLayers() {
        // Clear the main canvas
        const ctx = this.editor.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, this.editor.state.documentSize.width, this.editor.state.documentSize.height);
        
        // Render all visible layers from bottom to top
        this.layers.forEach(layer => {
            if (layer.visible) {
                ctx.globalAlpha = layer.opacity;
                ctx.drawImage(layer.canvas.getElement(), 0, 0);
            }
        });
    }

    getActiveCanvas() {
        return this.getActiveLayer().canvas;
    }
}