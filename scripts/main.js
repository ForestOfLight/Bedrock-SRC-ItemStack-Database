/**
 * Author: @gameza_src on Discord
 * ItemStack Database for Minecraft Bedrock Edition
 * @version 1.3.0
 * @module SRCItemDatabase
 * @description This module is used for saving and getting an 
 * ItemStack in a Minecraft world using the world structure manager.
 */
import {
    BlockVolume,
    EntityItemComponent,
    ItemStack,
    StructureSaveMode,
    world
} from "@minecraft/server";
import { Vector } from './lib/Vector.js';



class AsyncQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }
    enqueue(callback) {
        this.queue.push(callback);
        if (!this.processing) {
            this.dequeue();
        }
    }
    async dequeue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        const task = this.queue.shift();
        try {
            await task();
        } catch (e) {
            console.error('Error processing task:', e);
        } finally {
            this.processing = false;
            if (this.queue.length > 0) this.dequeue();
        }
    }
}

const globalAsyncQueue = new AsyncQueue(), itemMemory = new Map();

class SRCItemDatabase {
    constructor(table, saveMode = StructureSaveMode.World) {
        this.table = table + '_item:';
        this.saveMode = saveMode;
        this.asyncQueue = globalAsyncQueue;
        this.init();
    }
    static location = new Vector(1000000, -50, 1000000);
    static dimension = world.getDimension('overworld');
    async init() {
        const table = this.table.split('_')[0];
        if (table.length > 12)
            throw new Error(`Initialization Error for table: "${table}": The provided table name can't be more than 12 characters. Length: ${table.length}.`);
        await this.load();
    }
    async loadZone() {
        const loc = SRCItemDatabase.location,
            min = { x: loc.x - 1, y: loc.y - 1, z: loc.z - 1 }, max = { x: loc.x + 1, y: loc.y + 1, z: loc.z + 1 },
            airMin = { x: loc.x, y: loc.y, z: loc.z }, airMax = { x: loc.x, y: loc.y + 2, z: loc.z },
            volume = new BlockVolume(min, max), volume2 = new BlockVolume(airMin, airMax);
        await SRCItemDatabase.dimension.runCommand(`tickingarea add circle ${loc.x} ${loc.y} ${loc.z} 2 "idb" true`);
        await SRCItemDatabase.dimension.fillBlocks(volume, 'minecraft:bedrock', { ignoreChunkBoundErrors: true });
        await SRCItemDatabase.dimension.fillBlocks(volume2, 'minecraft:air', { ignoreChunkBoundErrors: true });
    };
    async load() {
        await this.loadZone();
        await this.asyncQueue.enqueue(async () => {
            const keys = this.getAllKeys();
            if (keys.length === 0) return;
            for (const key of keys) {
                const item = await this.getAsync(key);
                if (item) {
                    itemMemory.set(this.table + key, item);
                }
            }
        });
    }
    get(key) {
        const item = itemMemory.get(this.table + key)
        return item ? item : undefined;
    };
    async set(key, itemStack) {
        if (key.length > 12)
            throw new Error(`The provided key "${key}" exceeds the maximum allowed length of 12 characters (actual length: ${key.length}).`);
        let success = false;
        this.asyncQueue.enqueue(() => {
            const newId = this.table + key, existingStructure = world.structureManager.get(newId), location = SRCItemDatabase.location;
            if (existingStructure) {
                world.structureManager.delete(newId);
                itemMemory.delete(newId)
            };
           const newItem = SRCItemDatabase.dimension.spawnItem(itemStack, { x: location.x + 0.5, y: location.y, z: location.z + 0.5 });
            world.structureManager.createFromWorld(newId, SRCItemDatabase.dimension, location, location, {
                includeEntities: true,
                includeBlocks: false,
                saveMode: this.saveMode
            });
            const item = newItem.getComponent(EntityItemComponent.componentId).itemStack;
            itemMemory.set(newId, item);
            newItem.remove();
            success = true;
        });
        return success;
    };
    setMany(items) { return items.map(item => this.set(item.key, item.item)) };
    getAsync(key) {
        const newId = this.table + key, location = SRCItemDatabase.location, structure = world.structureManager.get(newId);
        if (!structure) return undefined;
        SRCItemDatabase.dimension.getEntities({ type: 'minecraft:item', location: location, maxDistance: 3 }).forEach(item => item.remove());
        world.structureManager.place(newId, SRCItemDatabase.dimension, location, { includeBlocks: false, includeEntities: true });
        const item = SRCItemDatabase.dimension.getEntities({ closest: 1, type: 'minecraft:item', location: location, maxDistance: 3 })[0];
        if (!item) return undefined;
        const itemStack = item.getComponent(EntityItemComponent.componentId).itemStack;
        item.remove();
        return itemStack;
    };
    getOnce(key) {
        const item = this.get(key);
        this.delete(key);
        return item;
    };
    getManyAsync(keys) { return keys.map(key => this.getAsync(key)) };
    getMany(keys) { return keys.map(key => this.get(key)) };
    delete(key) {
        const deleted = world.structureManager.delete(this.table + key)
        itemMemory.delete(this.table + key);
        return deleted;
    };
    deleteMany(keys) { return keys.forEach(key => this.delete(key)) };
    clear() {
        this.getAllKeys().forEach(key => this.delete(key));
        return true;
    };
    has(key) { return itemMemory.has(this.table + key) };
    hasAsync(key) { return Boolean(world.structureManager.get(this.table + key)) };
    getAllKeys() { return world.structureManager.getWorldStructureIds().filter(key => key.startsWith(this.table)).map(key => key.split(':')[1]) };
    getAll() { return this.getAllKeys().map(key => this.get(key)) };
    getAllAsync() { return this.getAllKeys().map(key => this.getAsync(key)) };
    setItems(key, items) {
        if (key.length > 12)
            throw new Error(`The provided key "${key}" exceeds the maximum allowed length of 12 characters (actual length: ${key.length}).`);
        return this.asyncQueue.enqueue(() => {
            const newId = this.table + key, existingStructure = world.structureManager.get(newId);
            if (existingStructure) {
                world.structureManager.delete(newId);
                itemMemory.delete(newId);
            }
            const location = SRCItemDatabase.location;
            SRCItemDatabase.dimension.getEntities({ type: 'minecraft:item', location, maxDistance: 3 }).forEach(item => item.remove())
            for (const item of items) 
                SRCItemDatabase.dimension.spawnItem(item, { x: location.x + 0.5, y: location.y, z: location.z + 0.5 });
            world.structureManager.createFromWorld(newId, SRCItemDatabase.dimension, location, location, {
                includeEntities: true,
                includeBlocks: false,
                saveMode: this.saveMode
            });
            itemMemory.set(newId, items);
        });
    }
    getItems(key) {
        if (key.length > 12)
            throw new Error(`The provided key "${key}" exceeds the maximum allowed length of 12 characters (actual length: ${key.length}).`);
        const newId = this.table + key, itemsS = itemMemory.get(newId), location = SRCItemDatabase.location;
        if (!itemsS) return [];
        if (!world.structureManager.get(newId)) return [];
        SRCItemDatabase.dimension.getEntities({ type: 'minecraft:item', location, maxDistance: 3 }).forEach(item => item.remove())
        world.structureManager.place(newId, SRCItemDatabase.dimension, location, { includeBlocks: false, includeEntities: true });
        const items = SRCItemDatabase.dimension.getEntities({ type: 'minecraft:item', location: location, maxDistance: 3 });
        if (items.length === 0) return undefined;
        const itemStacksArray = [];
        for (const item of items) {
            const itemStack = item.getComponent(EntityItemComponent.componentId).itemStack;
            itemStacksArray.push(itemStack);
            item.remove();
        }
        itemMemory.set(newId, itemStacksArray)
        return itemStacksArray;
    };
}
export default SRCItemDatabase;
