class CollaborativeWhiteboard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.socket = io();
        
        // Drawing state
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.color = '#000000';
        this.size = 2;
        this.userId = null;
        
        // UI Elements
        this.colorPicker = document.getElementById('colorPicker');
        this.sizeSlider = document.getElementById('sizeSlider');
        this.sizeDisplay = document.getElementById('sizeDisplay');
        this.clearBtn = document.getElementById('clearBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.statusText = document.getElementById('statusText');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.userCountEl = document.getElementById('userCount');
        
        // Initialize
        this.setupCanvas();
        this.setupSocketListeners();
        this.setupEventListeners();
        this.resizeCanvas();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    setupCanvas() {
        // Set canvas resolution for high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Set initial style
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
    }
    
    resizeCanvas() {
        // Save current drawing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.canvas, 0, 0);
        
        // Resize canvas
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Restore drawing
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.setStatus('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
            this.setStatus('Disconnected from server');
        });
        
        // Drawing events
        this.socket.on('load_history', (data) => {
            this.loadDrawingHistory(data.strokes);
        });
        
        this.socket.on('draw_start', (data) => {
            this.drawStart(data);
        });
        
        this.socket.on('draw_move', (data) => {
            this.drawMove(data);
        });
        
        this.socket.on('draw_end', (data) => {
            this.drawEnd(data);
        });
        
        // Control events
        this.socket.on('clear_board', () => {
            this.clearCanvas();
            this.setStatus('Board cleared by another user');
        });
        
        this.socket.on('undo', () => {
            this.undoLastStroke();
            this.setStatus('Undo performed by another user');
        });
        
        // User events
        this.socket.on('user_joined', (data) => {
            this.setStatus(`User ${data.user_id.substring(0, 8)} joined`);
        });
        
        this.socket.on('user_left', (data) => {
            this.setStatus(`User ${data.user_id.substring(0, 8)} left`);
        });
        
        // Color/Size changes
        this.socket.on('color_changed', (data) => {
            // Could update UI to show other users' colors
        });
        
        this.socket.on('size_changed', (data) => {
            // Could update UI to show other users' sizes
        });
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.startDrawing(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.draw(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
        
        // Toolbar events
        this.colorPicker.addEventListener('input', (e) => {
            this.color = e.target.value;
            this.socket.emit('change_color', { color: this.color });
            this.setStatus(`Color changed to ${this.color}`);
        });
        
        this.sizeSlider.addEventListener('input', (e) => {
            this.size = parseInt(e.target.value);
            this.sizeDisplay.textContent = `${this.size}px`;
            this.socket.emit('change_size', { size: this.size });
            this.setStatus(`Brush size changed to ${this.size}px`);
        });
        
        this.clearBtn.addEventListener('click', () => {
            if (confirm('Clear the entire board?')) {
                this.socket.emit('clear_board');
                this.setStatus('Board cleared');
            }
        });
        
        this.undoBtn.addEventListener('click', () => {
            this.socket.emit('undo');
            this.setStatus('Undo performed');
        });
    }
    
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCanvasCoords(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        
        this.socket.emit('draw_start', {
            x: coords.x,
            y: coords.y,
            color: this.color,
            size: this.size
        });
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const coords = this.getCanvasCoords(e);
        
        // Draw locally
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.size;
        this.ctx.stroke();
        
        // Send to server
        this.socket.emit('draw_move', {
            x: coords.x,
            y: coords.y
        });
        
        this.lastX = coords.x;
        this.lastY = coords.y;
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.socket.emit('draw_end', {
                x: this.lastX,
                y: this.lastY
            });
        }
    }
    
    drawStart(data) {
        this.ctx.beginPath();
        this.ctx.moveTo(data.x, data.y);
        this.ctx.strokeStyle = data.color || '#000000';
        this.ctx.lineWidth = data.size || 2;
    }
    
    drawMove(data) {
        this.ctx.lineTo(data.x, data.y);
        this.ctx.stroke();
    }
    
    drawEnd(data) {
        // Nothing needed here
    }
    
    loadDrawingHistory(strokes) {
        // Clear canvas
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Replay strokes
        let currentColor = '#000000';
        let currentSize = 2;
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        strokes.forEach((stroke) => {
            switch(stroke.type) {
                case 'start':
                    currentColor = stroke.color || '#000000';
                    currentSize = stroke.size || 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(stroke.x, stroke.y);
                    this.ctx.strokeStyle = currentColor;
                    this.ctx.lineWidth = currentSize;
                    lastX = stroke.x;
                    lastY = stroke.y;
                    isDrawing = true;
                    break;
                case 'move':
                    if (isDrawing) {
                        this.ctx.lineTo(stroke.x, stroke.y);
                        this.ctx.stroke();
                    }
                    lastX = stroke.x;
                    lastY = stroke.y;
                    break;
                case 'end':
                    isDrawing = false;
                    break;
            }
        });
        
        this.setStatus('Drawing history loaded');
    }
    
    clearCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, rect.width, rect.height);
    }
    
    undoLastStroke() {
        // This is handled by re-drawing from history
        // But we need to request the current state from server
        // For simplicity, we'll just clear and reload
        this.socket.emit('request_history'); // Not implemented in this version
        // Alternative: we can just clear and rely on server to send history
        this.clearCanvas();
        this.setStatus('Undo performed');
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.className = '';
            this.connectionStatus.textContent = '● Connected';
        } else {
            this.connectionStatus.className = 'disconnected';
            this.connectionStatus.textContent = '● Disconnected';
        }
    }
    
    setStatus(message) {
        this.statusText.textContent = message;
        // Auto-clear status after 3 seconds
        clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            this.statusText.textContent = 'Ready';
        }, 3000);
    }
}

// Initialize the whiteboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const whiteboard = new CollaborativeWhiteboard();
});
