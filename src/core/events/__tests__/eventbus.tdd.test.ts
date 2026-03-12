import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlobalEventBus } from '../GlobalEventBus';
import { StreamSentinel } from '../StreamSentinel';

describe('GlobalEventBus TDD: Core Pub/Sub logic', () => {
    it('should allow subscribing to and emitting events', () => {
        const bus = GlobalEventBus.getInstance();
        const callback = vi.fn();
        
        bus.on('test:event', callback);
        bus.emit('test:event', { foo: 'bar' });
        
        expect(callback).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should return an unlisten function that works', () => {
        const bus = GlobalEventBus.getInstance();
        const callback = vi.fn();
        
        const unlisten = bus.on('test:unlisten', callback);
        unlisten();
        
        bus.emit('test:unlisten', 'payload');
        expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers independently', () => {
        const bus = GlobalEventBus.getInstance();
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        
        bus.on('multi', cb1);
        bus.on('multi', cb2);
        
        bus.emit('multi', 123);
        
        expect(cb1).toHaveBeenCalledWith(123);
        expect(cb2).toHaveBeenCalledWith(123);
    });
});

describe('StreamSentinel TDD: Physical Stall Detection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        GlobalEventBus.getInstance().emit('test:reset'); // 假设哨兵有重置逻辑
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should emit "stream:stalled" after 5s of inactivity', () => {
        const bus = GlobalEventBus.getInstance();
        const sentinel = new StreamSentinel(bus);
        const stallCallback = vi.fn();
        
        bus.on('stream:stalled', stallCallback);
        
        // 1. 模拟流开始
        bus.emit('stream:start', { id: 'test-session' });
        
        // 2. 推进 4s (未到阈值)
        vi.advanceTimersByTime(4000);
        expect(stallCallback).not.toHaveBeenCalled();
        
        // 3. 再推进 1.1s (触发 5s 阈值)
        vi.advanceTimersByTime(1100);
        expect(stallCallback).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-session' }));
    });

    it('should NOT stall if heartbeats are received within 5s', () => {
        const bus = GlobalEventBus.getInstance();
        const sentinel = new StreamSentinel(bus);
        const stallCallback = vi.fn();
        
        bus.on('stream:stalled', stallCallback);
        
        bus.emit('stream:start', { id: 'test-session' });
        
        // 推进 3s
        vi.advanceTimersByTime(3000);
        
        // 4. 发送物理心跳
        bus.emit('stream:heartbeat', { id: 'test-session' });
        
        // 再推进 3s (总计 6s，但心跳重置了计时)
        vi.advanceTimersByTime(3000);
        expect(stallCallback).not.toHaveBeenCalled();
    });

    it('should stop monitoring after "stream:finish"', () => {
        const bus = GlobalEventBus.getInstance();
        const sentinel = new StreamSentinel(bus);
        const stallCallback = vi.fn();
        
        bus.on('stream:stalled', stallCallback);
        
        bus.emit('stream:start', { id: 'test-session' });
        bus.emit('stream:finish', { id: 'test-session' });
        
        vi.advanceTimersByTime(6000);
        expect(stallCallback).not.toHaveBeenCalled();
    });
});
