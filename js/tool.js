class ToolSystem {
    constructor(editor) {
        this.editor = editor;
        this.tools = {
            brush: new BrushTool(editor),
            eraser: new EraserTool(editor),
            fill: new FillTool(editor),
            selection: new SelectionTool(editor),
            wand: new MagicWandTool(editor),
            clone: new CloneStampTool(editor),
            gradient: new GradientTool(editor)
        };
    }

    getActiveTool() {
        return this.tools[this.editor.state.activeTool];
    }
}

class BrushTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'brush';
        this.icon = 'fas fa-paint-brush';
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = true;
        this.editor.updateBrush();
    }

    deactivate() {
        this.editor.fabricCanvas.isDrawingMode = false;
    }
}

class EraserTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'eraser';
        this.icon = 'fas fa-eraser';
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = true;
        this.editor.updateBrush();
    }

    deactivate() {
        this.editor.fabricCanvas.isDrawingMode = false;
    }
}

class FillTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'fill';
        this.icon = 'fas fa-fill-drip';
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = false;
        this.editor.fabricCanvas.selection = false;
        this.editor.fabricCanvas.on('mouse:down', this.onMouseDown);
    }

    deactivate() {
        this.editor.fabricCanvas.off('mouse:down', this.onMouseDown);
    }

    onMouseDown = (options) => {
        const pointer = this.editor.fabricCanvas.getPointer(options.e);
        const x = Math.floor(pointer.x);
        const y = Math.floor(pointer.y);
        
        const activeCanvas = this.editor.layers.getActiveCanvas();
        const ctx = activeCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
        
        this.floodFill(
            imageData.data, 
            x, 
            y, 
            hexToRgb(this.editor.state.foregroundColor),
            activeCanvas.width,
            activeCanvas.height
        );
        
        ctx.putImageData(imageData, 0, 0);
        this.editor.updateCanvas();
    };

    floodFill(data, x, y, targetColor, width, height) {
        // Convert hex color to RGBA
        const fillColor = hexToRgba(this.editor.state.foregroundColor, this.editor.state.brushOpacity);
        const fillRgba = parseColor(fillColor);
        
        // Get the target color at the clicked position
        const pos = (y * width + x) * 4;
        const targetR = data[pos];
        const targetG = data[pos + 1];
        const targetB = data[pos + 2];
        const targetA = data[pos + 3];
        
        // Don't fill if already the same color
        if (
            targetR === fillRgba.r &&
            targetG === fillRgba.g &&
            targetB === fillRgba.b &&
            targetA === fillRgba.a
        ) {
            return;
        }
        
        // Stack-based flood fill algorithm
        const stack = [[x, y]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const pos = (cy * width + cx) * 4;
            
            // Skip if out of bounds
            if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
            
            // Skip if already visited
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);
            
            // Check if pixel matches the target color
            if (
                data[pos] === targetR &&
                data[pos + 1] === targetG &&
                data[pos + 2] === targetB &&
                data[pos + 3] === targetA
            ) {
                // Fill the pixel
                data[pos] = fillRgba.r;
                data[pos + 1] = fillRgba.g;
                data[pos + 2] = fillRgba.b;
                data[pos + 3] = fillRgba.a;
                
                // Add neighboring pixels to stack
                stack.push([cx + 1, cy]);
                stack.push([cx - 1, cy]);
                stack.push([cx, cy + 1]);
                stack.push([cx, cy - 1]);
            }
        }
    }
}

class SelectionTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'selection';
        this.icon = 'fas fa-vector-square';
        this.selection = null;
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = false;
        this.editor.fabricCanvas.selection = true;
    }

    deactivate() {
        this.editor.fabricCanvas.selection = false;
    }
}

class MagicWandTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'wand';
        this.icon = 'fas fa-magic';
        this.tolerance = 30;
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = false;
        this.editor.fabricCanvas.selection = false;
        this.editor.fabricCanvas.on('mouse:down', this.onMouseDown);
    }

    deactivate() {
        this.editor.fabricCanvas.off('mouse:down', this.onMouseDown);
    }

    onMouseDown = (options) => {
        const pointer = this.editor.fabricCanvas.getPointer(options.e);
        const x = Math.floor(pointer.x);
        const y = Math.floor(pointer.y);
        
        const activeCanvas = this.editor.layers.getActiveCanvas();
        const ctx = activeCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
        
        const selection = this.getSimilarPixels(
            imageData.data, 
            x, 
            y, 
            this.tolerance,
            activeCanvas.width,
            activeCanvas.height
        );
        
        // Create a selection rectangle
        if (selection.pixels.length > 0) {
            const minX = Math.min(...selection.pixels.map(p => p.x));
            const minY = Math.min(...selection.pixels.map(p => p.y));
            const maxX = Math.max(...selection.pixels.map(p => p.x));
            const maxY = Math.max(...selection.pixels.map(p => p.y));
            
            const rect = new fabric.Rect({
                left: minX,
                top: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1,
                fill: 'rgba(64, 128, 255, 0.3)',
                stroke: 'rgba(64, 128, 255, 1)',
                strokeWidth: 1,
                selectable: true,
                hasControls: true,
                hasBorders: true
            });
            
            this.editor.fabricCanvas.add(rect);
            this.editor.fabricCanvas.setActiveObject(rect);
        }
    };

    getSimilarPixels(data, x, y, tolerance, width, height) {
        const pos = (y * width + x) * 4;
        const targetR = data[pos];
        const targetG = data[pos + 1];
        const targetB = data[pos + 2];
        const targetA = data[pos + 3];
        
        const pixels = [];
        const visited = new Set();
        const stack = [[x, y]];
        
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const cPos = (cy * width + cx) * 4;
            const key = `${cx},${cy}`;
            
            // Skip if out of bounds or already visited
            if (cx < 0 || cx >= width || cy < 0 || cy >= height || visited.has(key)) continue;
            visited.add(key);
            
            // Check if color is within tolerance
            const r = data[cPos];
            const g = data[cPos + 1];
            const b = data[cPos + 2];
            const a = data[cPos + 3];
            
            if (
                Math.abs(r - targetR) <= tolerance &&
                Math.abs(g - targetG) <= tolerance &&
                Math.abs(b - targetB) <= tolerance &&
                Math.abs(a - targetA) <= tolerance
            ) {
                pixels.push({ x: cx, y: cy });
                
                // Add neighboring pixels to stack
                stack.push([cx + 1, cy]);
                stack.push([cx - 1, cy]);
                stack.push([cx, cy + 1]);
                stack.push([cx, cy - 1]);
            }
        }
        
        return { pixels, color: { r: targetR, g: targetG, b: targetB, a: targetA } };
    }
}

class CloneStampTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'clone';
        this.icon = 'fas fa-clone';
        this.sourcePoint = null;
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = false;
        this.editor.fabricCanvas.selection = false;
        this.editor.fabricCanvas.on('mouse:down', this.onMouseDown);
        this.editor.fabricCanvas.on('mouse:move', this.onMouseMove);
    }

    deactivate() {
        this.editor.fabricCanvas.off('mouse:down', this.onMouseDown);
        this.editor.fabricCanvas.off('mouse:move', this.onMouseMove);
        this.sourcePoint = null;
    }

    onMouseDown = (options) => {
        if (options.e.altKey) {
            // Set source point when Alt is pressed
            const pointer = this.editor.fabricCanvas.getPointer(options.e);
            this.sourcePoint = {
                x: Math.floor(pointer.x),
                y: Math.floor(pointer.y)
            };
        } else if (this.sourcePoint) {
            // Clone from source to current position
            const pointer = this.editor.fabricCanvas.getPointer(options.e);
            const destX = Math.floor(pointer.x);
            const destY = Math.floor(pointer.y);
            
            const activeCanvas = this.editor.layers.getActiveCanvas();
            const ctx = activeCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
            
            // Get source area
            const sourceImageData = ctx.getImageData(
                this.sourcePoint.x, 
                this.sourcePoint.y, 
                this.editor.state.brushSize, 
                this.editor.state.brushSize
            );
            
            // Draw to destination
            ctx.putImageData(
                sourceImageData, 
                destX - this.editor.state.brushSize / 2, 
                destY - this.editor.state.brushSize / 2
            );
            
            this.editor.updateCanvas();
        }
    };

    onMouseMove = (options) => {
        if (options.e.altKey && !this.sourcePoint) {
            this.editor.canvasElement.style.cursor = 'crosshair';
        } else if (this.sourcePoint) {
            this.editor.canvasElement.style.cursor = 'copy';
        } else {
            this.editor.canvasElement.style.cursor = '';
        }
    };
}

class GradientTool {
    constructor(editor) {
        this.editor = editor;
        this.name = 'gradient';
        this.icon = 'fas fa-sliders-h';
        this.startPoint = null;
    }

    activate() {
        this.editor.fabricCanvas.isDrawingMode = false;
        this.editor.fabricCanvas.selection = false;
        this.editor.fabricCanvas.on('mouse:down', this.onMouseDown);
        this.editor.fabricCanvas.on('mouse:move', this.onMouseMove);
        this.editor.fabricCanvas.on('mouse:up', this.onMouseUp);
    }

    deactivate() {
        this.editor.fabricCanvas.off('mouse:down', this.onMouseDown);
        this.editor.fabricCanvas.off('mouse:move', this.onMouseMove);
        this.editor.fabricCanvas.off('mouse:up', this.onMouseUp);
        this.startPoint = null;
    }

    onMouseDown = (options) => {
        const pointer = this.editor.fabricCanvas.getPointer(options.e);
        this.startPoint = {
            x: Math.floor(pointer.x),
            y: Math.floor(pointer.y)
        };
    };

    onMouseMove = (options) => {
        if (this.startPoint) {
            const pointer = this.editor.fabricCanvas.getPointer(options.e);
            const endX = Math.floor(pointer.x);
            const endY = Math.floor(pointer.y);
            
            // Preview gradient
            this.drawGradientPreview(this.startPoint.x, this.startPoint.y, endX, endY);
        }
    };

    onMouseUp = (options) => {
        if (this.startPoint) {
            const pointer = this.editor.fabricCanvas.getPointer(options.e);
            const endX = Math.floor(pointer.x);
            const endY = Math.floor(pointer.y);
            
            // Apply gradient to active layer
            this.applyGradient(this.startPoint.x, this.startPoint.y, endX, endY);
            this.startPoint = null;
            this.editor.updateCanvas();
        }
    };

    drawGradientPreview(startX, startY, endX, endY) {
        // This would draw a temporary preview of the gradient
        // Implementation would be similar to applyGradient but to a temporary canvas
    }

    applyGradient(startX, startY, endX, endY) {
        const activeCanvas = this.editor.layers.getActiveCanvas();
        const ctx = activeCanvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, this.editor.state.foregroundColor);
        gradient.addColorStop(1, this.editor.state.backgroundColor);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, activeCanvas.width, activeCanvas.height);
    }
}

// Helper functions
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function parseColor(colorStr) {
    if (colorStr.startsWith('rgba')) {
        const parts = colorStr.substring(5, colorStr.length - 1).split(',');
        return {
            r: parseInt(parts[0]),
            g: parseInt(parts[1]),
            b: parseInt(parts[2]),
            a: parseFloat(parts[3])
        };
    } else if (colorStr.startsWith('rgb')) {
        const parts = colorStr.substring(4, colorStr.length - 1).split(',');
        return {
            r: parseInt(parts[0]),
            g: parseInt(parts[1]),
            b: parseInt(parts[2]),
            a: 1
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}