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


/**
 * This class is used for creating an AsyncQueue
 * @version 1.2.0
 * @class
 * @classdesc AsyncQueue allows for enqueuing and processing tasks asynchronously
 * @example const aQueue = new AsyncQueue();
 * aQueue.enqueue(() => console.log('Hello World'));
 */
class AsyncQueue {
    constructor() {
        /**@type { Function[] } */
        this.queue = [];
        /**@type { Boolean } */
        this.processing = false;
    }
    /**
    * 
    * This method is used to enqueue an action
    * @param {Function} callback The callback to enqueue
    * @returns {void}
    * @example SRCItemDatabase.enqueue(() => console.log('Hello World'))
    */
    enqueue(callback) {
        this.queue.push(callback);
        if (!this.processing) {
            this.dequeue();
        }
    }
    /**
     * 
     * This method is used to dequeue an action
     * @returns {Promise<void>}
     * @example SRCItemDatabase.dequeue()
     * @remarks This method is called internally
     */
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

// Create a global AsyncQueue and a Map to store the itemStacks
const globalAsyncQueue = new AsyncQueue(), itemMemory = new Map();

/**
 * This class is used for saving or getting an ItemStack from the database
 * @version 1.4.0
 * @class
 * @classdesc SRCItemDatabase allows for saving and retrieving ItemStacks in a Minecraft world using the world structure manager.
 * @remarks The default save mode is StructureSaveMode.World, and table name most be no more than 12 characters
 * @example let IManager;
 * world.afterEvents.worldInitialize.subscribe(() => system.runTimeout(() => IManager = new ItemManager('myTable'), 200));
 * IManager.save('1239483', new ItemStack('minecraft:stone', 64));
 * 
 * @example let IManager;
 * world.afterEvents.worldInitialize.subscribe(() => system.runTimeout(() => IManager = new ItemManager('myTable', StructureSaveMode.Memory), 200));
 * IManager.save('1239483', new ItemStack('minecraft:stone', 64));
 * IManager.get('1239483').typeId;
 */
class SRCItemDatabase {
    /**
     * 
     * @param {String} table The name of the Table to save the itemStack
     * @param {StructureSaveMode} saveMode The mode of saving: StructureSaveMode.World or StructureSaveMode.Memory
     * @example new SRCItemDatabase('myTable', StructureSaveMode.Memory);
     * @remarks The default save mode is StructureSaveMode.World
     * @remarks The save mode determines where the itemStack is saved in context of the Structure save mode
     */
    constructor(table, saveMode = StructureSaveMode.World) {
        /**
         * The name of the Table of this instance
         */
        this.table = table + '_item:';
        /**
         * The save mode of this instance
         */
        this.saveMode = saveMode;
        /**
         * The global AsyncQueue used for queuing tasks
         */
        this.asyncQueue = globalAsyncQueue;
        /**
         * The init method to initialize the instance
         */
        this.init();
    }
    /**
     * The location to save the itemStack
     */
    static location = new Vector(1000000, -50, 1000000);
    /**
     * The dimension used to save the itemStack
     */
    static dimension = world.getDimension('overworld');
    /**
     * The init method to initialize the class and load the all itemStacks in the memory
     * @returns {Promise<void>}
     */
    async init() {
        const table = this.table.split('_')[0];
        if (table.length > 12)
            throw new Error(`Initialization Error for table: "${table}": The provided table name can't be more than 12 characters. Length: ${table.length}.`);
        await this.load();
    }
    /**
     * 
     * This method is used to load the zone where the itemStacks are saved
     * @returns {Promise<void>}
     */
    async loadZone() {
        const loc = SRCItemDatabase.location,
            min = { x: loc.x - 1, y: loc.y - 1, z: loc.z - 1 }, max = { x: loc.x + 1, y: loc.y + 1, z: loc.z + 1 },
            airMin = { x: loc.x, y: loc.y, z: loc.z }, airMax = { x: loc.x, y: loc.y + 2, z: loc.z },
            volume = new BlockVolume(min, max), volume2 = new BlockVolume(airMin, airMax);
        await SRCItemDatabase.dimension.runCommand(`tickingarea add circle ${loc.x} ${loc.y} ${loc.z} 2 "idb" true`);
        await SRCItemDatabase.dimension.fillBlocks(volume, 'minecraft:bedrock', { ignoreChunkBoundErrors: true });
        await SRCItemDatabase.dimension.fillBlocks(volume2, 'minecraft:air', { ignoreChunkBoundErrors: true });
    };
    /**
     * This method is used to load the itemStacks saved in the world
     * @returns {Promise<void>}
     */
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
    /**
     * This method is used to get an itemStack from memory 
     * @param {String} key The key of the itemStack
     * @returns {ItemStack} The itemStack from memory if it exists
     */
    get(key) {
        const item = itemMemory.get(this.table + key)
        return item ? item : undefined;
    };
    /**
     * This method is used to save an itemStack
     * @param {String} key The key of the itemStack
     * @param {ItemStack} itemStack The itemStack to save
     * @returns {Boolean} True if the itemStack was saved successfully
     * @remarks The key most not be more than 12 characters
     */
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
            newItem = SRCItemDatabase.dimension.spawnItem(itemStack, { x: location.x + 0.5, y: location.y, z: location.z + 0.5 });
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
    /**
     * This method is used to save many itemStacks
     * @param {Array<{ key: String, item: ItemStack }>} items The items to save in the world
     * @returns {Boolean} True if the itemStacks were saved successfully
     */
    setMany(items) { return items.map(item => this.set(item.key, item.item)) };
    /**
     * This method is used to get an itemStack
     * @param {String} key The key of the itemStack
     * @returns {ItemStack} The itemStack
     */
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
    /**
     * 
     * This method is for getting an itemStack only once, then it will be deleted
     * @param {String} key The key of the itemStack to get
     * @returns {Promise<ItemStack>} The itemStack
     */
    getOnce(key) {
        const item = this.get(key);
        this.delete(key);
        return item;
    };
    /**
     * This method is used to get many itemStacks from the world
     * @param {Array<String>} keys The keys of the itemStacks
     * @returns {ItemStack[]} Array of itemStacks
     */
    getManyAsync(keys) { return keys.map(key => this.getAsync(key)) };
    /**
     * This method is used to get many itemStacks from the memory
     * @param {Array<String>} keys The keys of the itemStacks
     * @returns {ItemStack[]} Array of itemStacks
     */
    getMany(keys) { return keys.map(key => this.get(key)) };
    /**
     * This method is used to delete an itemStack
     * @param {String} key The key of the itemStack to delete
     * @returns {Boolean} True if the itemStack was deleted successfully
     */
    delete(key) {
        const deleted = world.structureManager.delete(this.table + key)
        itemMemory.delete(this.table + key);
        return deleted;
    };
    /**
     * This method is used to delete many itemStacks
     * @param {Array<String>} keys The keys of the itemStacks to delete
     * @returns {void}
     */
    deleteMany(keys) { return keys.forEach(key => this.delete(key)) };
    /**
     * This method is used to delete all itemStacks saved in the world
     * @returns {Boolean} True if all itemStacks were deleted successfully
     */
    clear() {
        this.getAllKeys().forEach(key => this.delete(key));
        return true;
    };
    /**
     * This method is used to check if an itemStack exists in the memory
     * @param {String} key The key of the itemStack to check
     * @returns {Boolean} True if the itemStack exists in the memory
     */
    has(key) { return itemMemory.has(this.table + key) };
    /**
     * This method is used to check if an itemStack exists
     * @param {String} key The key of the itemStack
     * @returns {Boolean} True if the itemStack exists
     */
    hasAsync(key) { return Boolean(world.structureManager.get(this.table + key)) };
    /**
     * This method is used to get all itemStack ids saved in the world
     * @returns {String[]} All itemStack ids saved in the world
     */
    getAllKeys() { return world.structureManager.getWorldStructureIds().filter(key => key.startsWith(this.table)).map(key => key.split(':')[1]) };
    /**
     * This method is used to get all itemStacks saved in the memory
     * @returns {ItemStack[]} All itemStacks saved in the memory
     * Returns all the items from the table
     */
    getAll() { return this.getAllKeys().map(key => this.get(key)) };
    /**
     * This method is used to get all itemStacks saved in the memory asynchronously
     * @returns {ItemStack[]} All itemStacks saved in the memory
     * Returns all the items from the table
     */
    getAllAsync() { return this.getAllKeys().map(key => this.getAsync(key)) };
    /**
     * 
     * This method is used to save an many itemStacks in a single key
     * @param {String} key 
     * @param {ItemStack[]} items 
     * @returns {void}
     * @example iManager.setItems('myItems', [new ItemStack('minecraft:stone', 64), new ItemStack('minecraft:diamond', 32)])
     * @remarks This method may have errors.
     */
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
    /**
     * 
     * This method is used to get many itemStacks saved in a single key
     * @param {String} key The key of the itemStacks 
     * @returns {ItemStack[]} The itemStacks
     * @example iManager.getItems('myItems')
     * @remarks This method may have errors.
     */
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
