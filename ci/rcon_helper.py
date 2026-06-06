#!/usr/bin/env python3
import socket, struct, sys

def rcon_read_packet(sock):
    try:
        raw = b''
        while len(raw) < 4:
            chunk = sock.recv(4 - len(raw))
            if not chunk: return None
            raw += chunk
        length = struct.unpack('<i', raw[:4])[0]
        if length < 8 or length > 4096: return None
        body_data = b''
        remaining = length
        while remaining > 0:
            chunk = sock.recv(min(remaining, 4096))
            if not chunk: return None
            body_data += chunk
            remaining -= len(chunk)
        if len(body_data) < 8: return None
        req_id = struct.unpack('<i', body_data[:4])[0]
        pkt_type = struct.unpack('<i', body_data[4:8])[0]
        payload = body_data[8:].rstrip(b'\x00').decode('utf-8', errors='replace')
        return (req_id, pkt_type, payload)
    except: return None

def rcon_login(sock, password):
    body = password.encode('utf-8') + b'\x00'
    data = struct.pack('<ii', 1, 3) + body + b'\x00'
    packet = struct.pack('<i', len(data)) + data
    sock.sendall(packet)
    for _ in range(2):
        pkt = rcon_read_packet(sock)
        if pkt is None: break
        req_id, pkt_type, _ = pkt
        if pkt_type == 2: return req_id == 1
    return False

def rcon_send(sock, cmd, req_id=2):
    body = cmd.encode('utf-8') + b'\x00'
    data = struct.pack('<ii', req_id, 2) + body + b'\x00'
    packet = struct.pack('<i', len(data)) + data
    sock.sendall(packet)
    pkt = rcon_read_packet(sock)
    if pkt is None: return ''
    _, _, payload = pkt
    return payload

if __name__ == '__main__':
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 25575
    password = sys.argv[3] if len(sys.argv) > 3 else 'test'
    command = sys.argv[4] if len(sys.argv) > 4 else 'op TestBot'
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((host, port))
    if rcon_login(sock, password):
        resp = rcon_send(sock, command)
        print(resp)
    else:
        print('WARNING: RCON login failed')
        sys.exit(1)
    sock.close()
