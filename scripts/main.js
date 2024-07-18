/**
 * Author: @gameza_src on Discord
 * Item Manager
 * @version 1.0.0
 * @module ItemManager
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
import { Vector } from "./lib/Vector.js";


/**
 * This class is used for creating an AsyncQueue
 * @version 1.0.0
 * @class
 * @classdesc AsyncQueue allows for enqueuing and processing tasks asynchronously
 * @example const aQueue = new AsyncQueue();
 * aQueue.enqueue(() => console.log('Hello World'));
 */
class AsyncQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    };
    /**
    * 
    * This method is used to enqueue an action
    * @param {Function} callback The callback to enqueue
    * @returns {void}
    * @example ItemManager.enqueue(() => console.log('Hello World'))
    */
    enqueue(callback) {
        this.queue.push(callback);
        if (!this.processing) {
            this.dequeue();
        }
    };
    /**
     * 
     * This method is used to dequeue an action
     * @returns {Promise<void>}
     * @example ItemManager.dequeue()
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
            if (this.queue.length > 0)
                this.dequeue();
        }
    };
}
// Crear una instancia global de AsyncQueue y un Map para guardar los itemStacks
const globalAsyncQueue = new AsyncQueue(), itemMemory = new Map();

/**
 * This class is used for saving and getting an ItemStack
 * @version 1.0.0
 * @class
 * @classdesc ItemManager allows for saving and retrieving ItemStacks in a Minecraft world using the world structure manager.
 * @example const iManager = new ItemManager('myTable');
 * iManager.save('1239483', new ItemStack('minecraft:stone', 64));
 * 
 * @example const iManager = new ItemManager('myTable', StructureSaveMode.Memory);
 * iManager.save('1239483', new ItemStack('minecraft:stone', 64));
 * iManager.get('1239483').typeId;
 */
class ItemManager {
    /**
     * 
     * @param {String} id The id of the Table to save the itemStack
     * @param {StructureSaveMode} saveMode The mode of saving: StructureSaveMode.World or StructureSaveMode.Memory
     * @example const iManager = new ItemManager(StructureSaveMode.Memory);
     * @remarks The default save mode is StructureSaveMode.World
     * @remarks The save mode determines where the itemStack is saved in context of the Structure save mode
     */
    constructor(id, saveMode = StructureSaveMode.World) {
        /**
         * The id of the Table of this instance
         */
        this.id = id + '_item:';
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
     * The init method to initialize the class and load the all itemStacks
     */
    async init() {
        await this.load();
    }
    /**
     * 
     * This method is used to load the zone where the itemStacks are saved
     * @returns {Promise<void>}
     */
    async loadZone() {
        const loc = ItemManager.location,
            min = { x: loc.x - 1, y: loc.y - 1, z: loc.z - 1 }, max = { x: loc.x + 1, y: loc.y + 1, z: loc.z + 1 },
            airMin = { x: loc.x, y: loc.y, z: loc.z }, airMax = { x: loc.x, y: loc.y + 2, z: loc.z };
        const volume = new BlockVolume(min, max), volume2 = new BlockVolume(airMin, airMax);
        await ItemManager.dimension.runCommand(`tickingarea add circle ${loc.x} ${loc.y} ${loc.z} 2 "idb" true`);
        await ItemManager.dimension.fillBlocks(volume, 'minecraft:bedrock', { ignoreChunkBoundErrors: true });
        await ItemManager.dimension.fillBlocks(volume2, 'minecraft:air', { ignoreChunkBoundErrors: true });
    };
    /**
     * This method is used to load the itemStacks saved in the world
     * @returns {Promise<void>}
     */
    async load() {
        await this.loadZone();
        await this.asyncQueue.enqueue(async () => {
            console.warn('Loading itemStacks... 5');
            const iDs = this.getAllIds();
            if (iDs.length === 0) return;
            console.warn('Loading itemStacks... 4');
            for (const id of iDs) {
                console.warn('Loading itemStacks... 3');
                const item = await this.getAsync(id);
                console.warn('Loading itemStacks... 2');
                if (item) {
                    itemMemory.set(this.id + id, item);
                    console.warn('Loading itemStacks... 1');
                }
            }
        });
    }
    /**
     * This method is used to get an itemStack from memory 
     * @param {String} id The id of the itemStack
     * @returns {ItemStack} The itemStack from memory if it exists
     */
    get(id) {
        const item = itemMemory.get(this.id + id)
        return item ? item : undefined;
    };
    /**
     * This method is used to save an itemStack
     * @param {String} id The id of the itemStack
     * @param {ItemStack} itemStack The itemStack to save
     * @returns {Promise<Boolean>} True if the itemStack was saved successfully
     */
    async save(id, itemStack) {
        return new Promise(resolve => {
            this.asyncQueue.enqueue(async () => {
                const newId = this.id + id, existingStructure = await world.structureManager.get(newId);
                if (existingStructure) {
                    console.warn(`Structure with identifier '${newId}' already exists.`);
                    return resolve(false);
                }
                const location = ItemManager.location,
                    newItem = ItemManager.dimension.spawnItem(itemStack, { x: location.x + 0.5, y: location.y, z: location.z + 0.5 });
                await world.structureManager.createFromWorld(newId, ItemManager.dimension, location, location,
                    { includeEntities: true, includeBlocks: false, saveMode: this.saveMode });
                const item = newItem.getComponent(EntityItemComponent.componentId).itemStack;
                itemMemory.set(newId, item)
                newItem.remove();
                resolve(true);
            });
        });
    };
    /**
     * This method is used to save many itemStacks
     * @param {Array<{ id: String, item: ItemStack }>} items The items to save in the world
     * @returns {Promise<Boolean>} True if the itemStacks were saved successfully
     */
    async saveMany(items) { return Promise.all(items.map(item => this.save(item.id, item.item))) };
    /**
     * This method is used to get an itemStack
     * @param {String} id The id of the itemStack
     * @returns {ItemStack} The itemStack
     */
    async getAsync(id) {
        const newId = this.id + id, location = ItemManager.location, structure = await world.structureManager.get(newId);
        if (!structure) return undefined;
        await world.structureManager.place(newId, ItemManager.dimension, location, { includeBlocks: false, includeEntities: true });
        const item = ItemManager.dimension.getEntities({ closest: 1, type: 'minecraft:item', location: location, maxDistance: 3 })[0];
        if (!item) return undefined;
        const itemStack = item.getComponent(EntityItemComponent.componentId).itemStack;
        item.remove();
        return itemStack;
    };

    /**
     * 
     * This method is for getting an itemStack only once, then it will be deleted
     * @param {String} id The id of the itemStack to get
     * @returns {Promise<ItemStack>} The itemStack
     */
    getOnce(id) {
        const item = this.get(id);
        this.delete(id);
        return item;
    };
    /**
     * This method is used to get many itemStacks from the world
     * @param {Array<String>} ids The ids of the itemStacks
     * @returns {Promise<ItemStack[]>} Array of itemStacks
     */
    async getManyAsync(ids) { return Promise.all(ids.map(id => this.get(id))) };
    /**
     * This method is used to get many itemStacks from the memory
     * @param {Array<String>} ids The ids of the itemStacks
     * @returns {ItemStack[]} Array of itemStacks
     */
    getMany(ids) { return ids.map(id => this.get(id)) };
    /**
     * This method is used to delete an itemStack
     * @param {String} id The id of the itemStack to delete
     * @returns {Boolean} True if the itemStack was deleted successfully
     */
    delete(id) {
        const deleted = world.structureManager.delete(this.id + id)
        itemMemory.delete(this.id + id);
        return deleted;
    };
    /**
     * This method is used to delete many itemStacks
     * @param {Array<String>} ids The ids of the itemStacks to delete
     * @returns {void}
     */
    deleteMany(ids) { return ids.forEach(id => this.delete(id)) };
    /**
     * This method is used to delete all itemStacks saved in the world
     * @returns {Boolean} True if all itemStacks were deleted successfully
     */
    deleteAll() {
        this.getAllIds().forEach(id => this.delete(id));
        return true;
    };
    /**
     * This method is used to check if an itemStack exists in the memory
     * @param {String} id The id of the itemStack to check
     * @returns {Boolean} True if the itemStack exists in the memory
     */
    hasItem(id) { return itemMemory.has(this.id + id) };
    /**
     * This method is used to check if an itemStack exists
     * @param {String} id The id of the itemStack
     * @returns {Boolean} True if the itemStack exists
     */
    hasItemAsync(id) { return world.structureManager.get(this.id + id) ? true : false };
    /**
     * This method is used to get all itemStack ids saved in the world
     * @returns {String[]} All itemStack ids saved in the world
     */
    getAllIds() { return world.structureManager.getWorldStructureIds().filter(id => id.startsWith(this.id)).map(id => id.split(':')[1]) };
    /**
     * This method is used to get all itemStacks saved in the world
     * @returns {Promise<ItemStack[]>} All itemStacks saved in the world
     */
    async getAllItemsAsync() { return Promise.all(this.getAllIds().map(id => this.getAsync(id))) };
    /**
     * This method is used to get all itemStacks saved in the memory
     * @returns {ItemStack[]} All itemStacks saved in the memory
     * Returns all the items fro the table this.id
     */
    getAllItems() { return this.getAllIds().map(id => this.get(id)) };
}
export default ItemManager;


import('./Tests/test.js');