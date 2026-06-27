from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import base64
from datetime import datetime
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here-change-in-production'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store drawing history
drawing_history = {
    'strokes': [],
    'users': {}
}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    """Handle new user connection"""
    print(f'Client connected: {request.sid}')
    
    # Send current drawing state to new user
    if drawing_history['strokes']:
        emit('load_history', {
            'strokes': drawing_history['strokes']
        })
    
    # Broadcast new user
    emit('user_joined', {
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle user disconnection"""
    print(f'Client disconnected: {request.sid}')
    emit('user_left', {
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

@socketio.on('draw_start')
def handle_draw_start(data):
    """Handle start of a drawing stroke"""
    stroke_data = {
        'type': 'start',
        'x': data['x'],
        'y': data['y'],
        'color': data.get('color', '#000000'),
        'size': data.get('size', 2),
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }
    drawing_history['strokes'].append(stroke_data)
    emit('draw_start', stroke_data, broadcast=True, include_self=False)

@socketio.on('draw_move')
def handle_draw_move(data):
    """Handle drawing movement"""
    stroke_data = {
        'type': 'move',
        'x': data['x'],
        'y': data['y'],
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }
    drawing_history['strokes'].append(stroke_data)
    emit('draw_move', stroke_data, broadcast=True, include_self=False)

@socketio.on('draw_end')
def handle_draw_end(data):
    """Handle end of a drawing stroke"""
    stroke_data = {
        'type': 'end',
        'x': data['x'],
        'y': data['y'],
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }
    drawing_history['strokes'].append(stroke_data)
    emit('draw_end', stroke_data, broadcast=True, include_self=False)

@socketio.on('clear_board')
def handle_clear_board():
    """Clear the entire board"""
    drawing_history['strokes'] = []
    emit('clear_board', {
        'user_id': request.sid,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

@socketio.on('undo')
def handle_undo():
    """Undo last stroke"""
    if drawing_history['strokes']:
        # Find last stroke (remove from end)
        last_stroke_index = -1
        for i in range(len(drawing_history['strokes']) - 1, -1, -1):
            if drawing_history['strokes'][i]['type'] == 'start':
                last_stroke_index = i
                break
        
        if last_stroke_index != -1:
            # Remove the stroke
            del drawing_history['strokes'][last_stroke_index:]
            emit('undo', {
                'user_id': request.sid,
                'timestamp': datetime.now().isoformat()
            }, broadcast=True)

@socketio.on('change_color')
def handle_change_color(data):
    """Handle color change"""
    emit('color_changed', {
        'user_id': request.sid,
        'color': data['color'],
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

@socketio.on('change_size')
def handle_change_size(data):
    """Handle brush size change"""
    emit('size_changed', {
        'user_id': request.sid,
        'size': data['size'],
        'timestamp': datetime.now().isoformat()
    }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
