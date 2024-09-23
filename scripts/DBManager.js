import Database from "./Database";

/**
 * Database manager
 * @module DatabaseManager
 * @extends Database The database class to access stored data
 * @version 1.0.0
 * @example
 * Databases.config.get('key')
 */
class DatabaseManager {
    constructor() {
        /**
         * 
         * @returns {Database} Config database
         * @remarks Config database is used to store configuration data
         */
        this.config = new Database('config');
        /**
         * 
         * @returns {Database} Players database
         * @remarks Players database is used to store player data
         */
        this.players = new Database('players');
        /**
         * 
         * @returns {Database} Server data database
         * @remarks Server data database is used to store server data
         */
        this.server = new Database("server");
        /**
         * 
         * @returns {Database} Chat log database
         * @remarks Chat log database is used to store chat messages from players
         */
        this.chatLog = new Database('chatLog');
        /**
         * 
         * @returns {Database} Bans database
         * @remarks Bans database is used to store player bans
         */
        this.Bans = new Database('bans');
        /**
         * 
         * @returns {Database} Faction database
         * @remarks Is used to store faction data
         */
        this.factionData = new Database('facData');
        /**
         * @returns {Database} Event database for events
         * @remarks Is used to store event data
         */
        this.eventData = new Database('eventData');
        /**
         * 
         * @returns {Database} Shop database for items
         * @remarks Is used to store the amount of times an item has been bought
         */
        this.shopCounter = new Database('shopItemCounter');
        /**
         * @returns {Database} Black market database
         * 
         */
        this.blackMarket = new Database('blackMarket');
        /**
         * @returns {Database} Quests database
         * 
         */
        this.quests = new Database('questDb');
        /**
         * @returns {Database} Kits database
         * 
         */
        this.kits = new Database('kits');
        /**
         * @returns {Database} Stock market database
         * @remarks Is used to store stock market data
         */
        this.stockMarket = new Database('stockMarket');
        /**
         * @returns {Database} Reports database
         * @remarks Is used to store player reports
         */
        this.reports = new Database('reports');
        /**
         * @returns {Database} chat database
         * @remarks Is used to store players chat messages
         */
        this.chatLog = new Database('chatDB');
        /**
         * @returns {Database} online players database
         * @remarks Is used to store online players
         */
        this.usersOnline = new Database('plrOnline');
        /**
         * @returns {Database} structure ids database
         * @remarks Is used to store structure ids
         */
        this.structureIds = new Database('structureIds');
        /**
         * @returns {Database} Pets database
         * @remarks Is used to store the players pets
         */
        this.petData = new Database('pets');
    }
}
/**
 * Database manager
 * @module DatabaseManager
 * @extends Database The database class to access stored data
 * @version 1.0.0
 * @example
 * Databases.config.get('key')
 */

export const Databases = new DatabaseManager();
