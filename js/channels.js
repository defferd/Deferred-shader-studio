class ChannelSystem {
    constructor(editor) {
        this.editor = editor;
        this.channels = {
            base: { name: 'Base Color', visible: true },
            normal: { name: 'Normal Map', visible: false },
            metallic: { name: 'Metallic', visible: false },
            roughness: { name: 'Roughness', visible: false },
            ao: { name: 'Ambient Occlusion', visible: false }
        };
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.channelButtons = document.querySelectorAll('.channel-btn');
        this.metallicControl = document.getElementById('metallic-control');
        this.roughnessControl = document.getElementById('roughness-control');
    }

    initEventListeners() {
        this.channelButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveChannel(button.dataset.channel);
            });
        });
        
        // Metallic control
        this.metallicControl.querySelector('input').addEventListener('input', (e) => {
            const value = e.target.value;
            this.metallicControl.querySelector('span').textContent = `${value}%`;
            this.updateChannelDisplay();
        });
        
        // Roughness control
        this.roughnessControl.querySelector('input').addEventListener('input', (e) => {
            const value = e.target.value;
            this.roughnessControl.querySelector('span').textContent = `${value}%`;
            this.updateChannelDisplay();
        });
    }

    setActiveChannel(channelName) {
        if (this.channels[channelName]) {
            this.editor.state.activeChannel = channelName;
            this.updateChannelButtons();
            this.updateChannelDisplay();
        }
    }

    updateChannelButtons() {
        this.channelButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.channel === this.editor.state.activeChannel);
        });
    }

    updateChannelDisplay() {
        // Show/hide controls based on active channel
        this.metallicControl.style.display = 
            this.editor.state.activeChannel === 'metallic' ? 'block' : 'none';
        this.roughnessControl.style.display = 
            this.editor.state.activeChannel === 'roughness' ? 'block' : 'none';
        
        // Update the canvas display based on active channel
        this.editor.updateCanvas();
    }

    getActiveChannelData() {
        // This would return the image data for the active channel
        // In a real implementation, you'd have separate canvases for each channel
        const activeCanvas = this.editor.layers.getActiveCanvas();
        return activeCanvas.getContext('2d').getImageData(0, 0, activeCanvas.width, activeCanvas.height);
    }

    applyPbrToTexture() {
        // This would combine all channels into a final PBR texture
        // Implementation would depend on how you're exporting the textures
    }
}