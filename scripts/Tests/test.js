import { Player, world, ItemStack } from "@minecraft/server";
import ItemManager from "../ItemDatabase";

/**
 * 
 * First we need to wait for the world to initialize, then we can create a new instance of the ItemManager class.
 * This is because the Database needs to load all the saved structures in order to get the items.
 * @type {ItemManager}
 */
let IManager;
world.afterEvents.worldInitialize.subscribe(() => system.runTimeout(() => IManager = new ItemManager('myTable'), 200));

world.afterEvents.itemUse.subscribe(({ source: player, itemStack: item }) => {
    if (!(player instanceof Player)) return;
    if (!item || item.type !== 'minecraft:apple') return;
    const start = Date.now();
    IManager.save('myItem', new ItemStack('minecraft:apple', 64));
    console.warn('Time to fully save an Item: ' + (Date.now() - start) + 'ms');
})

world.afterEvents.itemUse.subscribe(({ source: player }) => {
    if (!(player instanceof Player)) return;
    if (!item || item.type !== 'minecraft:stick') return;
    const item = IManager.get('myItem'), inv = player.getComponent('minecraft:inventory').container;
    inv.addItem(item);
    IManager.delete('myItem');
    console.log('Item added to inventory');
})
