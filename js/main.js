class TextureEditor {
    constructor() {
        this.initElements();
        this.initCanvas();
        this.initState();
        this.initEventListeners();
        this.initTools();
        this.initLayers();
        this.initChannels();
        this.init3DPreview();
        this.initProject();
        
        // Start with a default layer
        this.layers.addLayer('Base Layer');
        
        // Update UI
        this.updateUI();
    }

    initElements() {
        // Main canvas elements
        this.canvasElement = document.getElementById('main-canvas');
        this.gridCanvasElement = document.getElementById('grid-canvas');
        
        // Tool elements
        this.toolButtons = document.querySelectorAll('.tool-btn');
        this.brushSizeInput = document.getElementById('brush-size');
        this.brushOpacityInput = document.getElementById('brush-opacity');
        this.brushHardnessInput = document.getElementById('brush-hardness');
        this.brushSizeValue = document.getElementById('brush-size-value');
        this.brushOpacityValue = document.getElementById('brush-opacity-value');
        this.brushHardnessValue = document.getElementById('brush-hardness-value');
        
        // Color elements
        this.foregroundColorInput = document.getElementById('foreground-color');
        this.backgroundColorInput = document.getElementById('background-color');
        this.swapColorsButton = document.getElementById('swap-colors');
        
        // Zoom elements
        this.zoomInButton = document.getElementById('zoom-in-btn');
        this.zoomOutButton = document.getElementById('zoom-out-btn');
        this.zoomLevelDisplay = document.getElementById('zoom-level');
        
        // Status bar elements
        this.cursorPositionDisplay = document.getElementById('cursor-position');
        this.activeToolDisplay = document.getElementById('active-tool');
        
        // Other UI elements
        this.canvasContainer = document.querySelector('.canvas-container');
    }

    initCanvas() {
        // Main fabric canvas
        this.fabricCanvas = new fabric.Canvas(this.canvasElement, {
            isDrawingMode: false,
            selection: false,
            backgroundColor: 'transparent',
            preserveObjectStacking: true
        });

        // Grid canvas
        this.gridCanvas = this.gridCanvasElement.getContext('2d');
        this.drawGrid();

        // Current zoom level
        this.zoomLevel = 1.0;
        this.updateCanvasZoom();
    }

    drawGrid() {
        const gridSize = 16;
        const width = this.gridCanvasElement.width;
        const height = this.gridCanvasElement.height;
        
        this.gridCanvas.clearRect(0, 0, width, height);
        
        // Draw grid only if zoomed in enough
        if (this.zoomLevel >= 0.5) {
            this.gridCanvas.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.gridCanvas.lineWidth = 1;
            
            // Vertical lines
            for (let x = 0; x <= width; x += gridSize) {
                this.gridCanvas.beginPath();
                this.gridCanvas.moveTo(x, 0);
                this.gridCanvas.lineTo(x, height);
                this.gridCanvas.stroke();
            }
            
            // Horizontal lines
            for (let y = 0; y <= height; y += gridSize) {
                this.gridCanvas.beginPath();
                this.gridCanvas.moveTo(0, y);
                this.gridCanvas.lineTo(width, y);
                this.gridCanvas.stroke();
            }
        }
    }

    initState() {
        this.state = {
            activeTool: 'brush',
            foregroundColor: '#ffffff',
            backgroundColor: '#000000',
            brushSize: 10,
            brushOpacity: 1.0,
            brushHardness: 0.8,
            activeChannel: 'base',
            documentSize: { width: 1024, height: 1024 },
            cursorPosition: { x: 0, y: 0 },
            isPanning: false,
            lastPanPosition: { x: 0, y: 0 }
        };
    }

    initEventListeners() {
        // Tool buttons
        this.toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveTool(button.dataset.tool);
            });
        });

        // Brush options
        this.brushSizeInput.addEventListener('input', () => {
            this.state.brushSize = parseInt(this.brushSizeInput.value);
            this.brushSizeValue.textContent = `${this.state.brushSize}px`;
            this.updateBrush();
        });

        this.brushOpacityInput.addEventListener('input', () => {
            this.state.brushOpacity = parseInt(this.brushOpacityInput.value) / 100;
            this.brushOpacityValue.textContent = `${Math.round(this.state.brushOpacity * 100)}%`;
            this.updateBrush();
        });

        this.brushHardnessInput.addEventListener('input', () => {
            this.state.brushHardness = parseInt(this.brushHardnessInput.value) / 100;
            this.brushHardnessValue.textContent = `${Math.round(this.state.brushHardness * 100)}%`;
            this.updateBrush();
        });

        // Color controls
        this.foregroundColorInput.addEventListener('input', (e) => {
            this.state.foregroundColor = e.target.value;
        });

        this.backgroundColorInput.addEventListener('input', (e) => {
            this.state.backgroundColor = e.target.value;
        });

        this.swapColorsButton.addEventListener('click', () => {
            const temp = this.state.foregroundColor;
            this.state.foregroundColor = this.state.backgroundColor;
            this.state.backgroundColor = temp;
            this.foregroundColorInput.value = this.state.foregroundColor;
            this.backgroundColorInput.value = this.state.backgroundColor;
        });

        // Zoom controls
        this.zoomInButton.addEventListener('click', () => {
            this.setZoom(this.zoomLevel * 1.2);
        });

        this.zoomOutButton.addEventListener('click', () => {
            this.setZoom(this.zoomLevel / 1.2);
        });

        // Canvas mouse events
        this.fabricCanvas.on('mouse:move', (e) => {
            const pointer = this.fabricCanvas.getPointer(e.e);
            this.state.cursorPosition = {
                x: Math.floor(pointer.x / this.zoomLevel),
                y: Math.floor(pointer.y / this.zoomLevel)
            };
            this.cursorPositionDisplay.textContent = `X: ${this.state.cursorPosition.x}, Y: ${this.state.cursorPosition.y}`;
        });

        // Panning with middle mouse button
        this.canvasElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                this.state.isPanning = true;
                this.state.lastPanPosition = { x: e.clientX, y: e.clientY };
                this.canvasElement.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.state.isPanning) {
                const dx = e.clientX - this.state.lastPanPosition.x;
                const dy = e.clientY - this.state.lastPanPosition.y;
                
                this.canvasContainer.scrollLeft -= dx;
                this.canvasContainer.scrollTop -= dy;
                
                this.state.lastPanPosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.state.isPanning = false;
                this.canvasElement.style.cursor = '';
                e.preventDefault();
            }
        });

        // Prevent default middle mouse button behavior
        document.addEventListener('auxclick', (e) => {
            if (e.button === 1) e.preventDefault();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Tool shortcuts
            if (e.key === 'b') this.setActiveTool('brush');
            if (e.key === 'e') this.setActiveTool('eraser');
            if (e.key === 'g') this.setActiveTool('fill');
            if (e.key === 'm') this.setActiveTool('selection');
            if (e.key === 'w') this.setActiveTool('wand');
            if (e.key === 'c') this.setActiveTool('clone');
            if (e.key === 'l') this.setActiveTool('gradient');
            
            // Color swap
            if (e.key === 'x') this.swapColors();
            
            // Zoom
            if (e.ctrlKey && e.key === '+') this.setZoom(this.zoomLevel * 1.2);
            if (e.ctrlKey && e.key === '-') this.setZoom(this.zoomLevel / 1.2);
            if (e.ctrlKey && e.key === '0') this.setZoom(1.0);
        });
    }

    setActiveTool(toolName) {
        this.state.activeTool = toolName;
        this.updateActiveTool();
    }

    updateActiveTool() {
        // Update tool buttons
        this.toolButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tool === this.state.activeTool);
        });
        
        // Update status bar
        this.activeToolDisplay.textContent = this.state.activeTool.charAt(0).toUpperCase() + 
                                           this.state.activeTool.slice(1);
        
        // Update canvas behavior based on tool
        switch (this.state.activeTool) {
            case 'brush':
            case 'eraser':
                this.fabricCanvas.isDrawingMode = true;
                this.updateBrush();
                break;
            default:
                this.fabricCanvas.isDrawingMode = false;
        }
    }

    updateBrush() {
        if (this.state.activeTool === 'brush' || this.state.activeTool === 'eraser') {
            const color = this.state.activeTool === 'eraser' ? 'rgba(0, 0, 0, 0)' : 
                         hexToRgba(this.state.foregroundColor, this.state.brushOpacity);
            
            this.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(this.fabricCanvas);
            this.fabricCanvas.freeDrawingBrush.color = color;
            this.fabricCanvas.freeDrawingBrush.width = this.state.brushSize;
            
            // Simulate hardness by making the brush partially transparent towards edges
            this.fabricCanvas.freeDrawingBrush.shadow = new fabric.Shadow({
                color: color,
                blur: this.state.brushSize * (1 - this.state.brushHardness),
                offsetX: 0,
                offsetY: 0
            });
        }
    }

    setZoom(level) {
        // Constrain zoom level
        this.zoomLevel = Math.max(0.1, Math.min(5, level));
        this.updateCanvasZoom();
    }

    updateCanvasZoom() {
        const zoomPercent = Math.round(this.zoomLevel * 100);
        this.zoomLevelDisplay.textContent = `${zoomPercent}%`;
        
        // Scale the canvas
        this.canvasElement.style.transform = `scale(${this.zoomLevel})`;
        this.gridCanvasElement.style.transform = `scale(${this.zoomLevel})`;
        
        // Adjust container size to account for zoom
        const scaledWidth = this.state.documentSize.width * this.zoomLevel;
        const scaledHeight = this.state.documentSize.height * this.zoomLevel;
        
        this.canvasElement.style.width = `${scaledWidth}px`;
        this.canvasElement.style.height = `${scaledHeight}px`;
        this.gridCanvasElement.style.width = `${scaledWidth}px`;
        this.gridCanvasElement.style.height = `${scaledHeight}px`;
        
        // Redraw grid
        this.drawGrid();
    }

    updateUI() {
        // Update all UI elements based on current state
        this.updateActiveTool();
        this.updateBrush();
        
        // Update color inputs
        this.foregroundColorInput.value = this.state.foregroundColor;
        this.backgroundColorInput.value = this.state.backgroundColor;
        
        // Update brush options
        this.brushSizeInput.value = this.state.brushSize;
        this.brushOpacityInput.value = Math.round(this.state.brushOpacity * 100);
        this.brushHardnessInput.value = Math.round(this.state.brushHardness * 100);
        
        this.brushSizeValue.textContent = `${this.state.brushSize}px`;
        this.brushOpacityValue.textContent = `${Math.round(this.state.brushOpacity * 100)}%`;
        this.brushHardnessValue.textContent = `${Math.round(this.state.brushHardness * 100)}%`;
    }

    swapColors() {
        const temp = this.state.foregroundColor;
        this.state.foregroundColor = this.state.backgroundColor;
        this.state.backgroundColor = temp;
        this.foregroundColorInput.value = this.state.foregroundColor;
        this.backgroundColorInput.value = this.state.backgroundColor;
        this.updateBrush();
    }
}

// Helper function to convert hex to rgba
function hexToRgba(hex, opacity = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.textureEditor = new TextureEditor();
});