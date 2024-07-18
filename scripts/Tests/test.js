import { Player, world, ItemStack } from "@minecraft/server";
import ItemManager from "../main";

const iManager = new ItemManager('myTable'), start = Date.now();
world.afterEvents.worldInitialize.subscribe(() => {
    console.warn('Time to fully load: ' + (Date.now() - start) + 'ms');
    iManager.save('XD', new ItemStack('minecraft:stone', 64));
    console.warn('Time to fully save an Item: ' + (Date.now() - start) + 'ms');
});

world.afterEvents.itemUse.subscribe(({ source: player }) => {
    if (!(player instanceof Player)) return;
    const item = iManager.get('XD');
    const inv = player.getComponent('minecraft:inventory').container;
    inv.addItem(item);
})