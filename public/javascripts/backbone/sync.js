/**
 * A Persistence.js adapter for Backbone.js
 *
 * David Francisco (hello@dmfranc.com)
 * -----------------------------------------------------------------------------------
 * Replacement for Backbone.Sync() to handle saving using the persistence.js library
 * Why should I care?
 * Using this adapter with persistence.js, you can save your data using HTML5 WebSQL
 * database, saving data in memory, with HTML5 localStorage, Google Gears, etc..
 * But more important is that it also supports synchronization with a remote server.
 *
 * Including this adapter in your backbone.js project you can:
 * - Save your data locally (WebSQL, localStorage, etc.)
 * - Sync with a remote server when changes happens and both user and server are online
 * Synchronization works both ways (supports multiple clients)
 **/

// Which DB do you want to use today?
// persistence.store.websql.config(persistence, "webapp", 'database', 5 * 1024 * 1024);
persistence.store.memory.config(persistence, 'database', 5 * 1024 * 1024, '1.0');

/* */   // APPLICATION SPECIFIC CODE
/* */
/* */   // The database table
/* */   var ItemEntity = persistence.define('Item4', {
/* */     // Specific attributes from this entity (**can be modified**)
/* */     name: "TEXT",
/* */     category: "TEXT",
/* */     // Required attributes
/* */     dirty: "BOOL",  // Required for syncing
/* */     deleted: "BOOL" // Required to simulate deletions
/* */   });
/* */
/* */   // This array should match the columns of the table, and is used to convert
/* */   // between persistence.js objects and backbone.js models
/* */   var itemAttributes = ['name', 'category', 'dirty', 'deleted']
/* */
/* */   // Fill persistence.js object with data from backbone.js model
/* */   function convertModel(item, model) {
/* */       item.name     = model.get('name');
/* */       item.category = model.get('category');
/* */   }
/* */
/* */   // Convert persistence.js object to JSON
/* */   function toJSON(item) {
/* */       // TODO obj.selectJSON(...) could probably be used to generalize this function
/* */       return { "id":item.id, "name":item.name, "category":item.category,
/* */           "deleted":item.deleted, "dirty":item.dirty }
/* */   }

// URI to sync with server
ItemEntity.enableSync('/items/sync.json');

// Confs
persistence.debug = true;
persistence.schemaSync();
var session = persistence;


// Sync local database with server
function sync(callback, item) {
    ItemEntity.syncAll(persistence, '/items/sync.json', persistence.sync.preferRemoteConflictHandler, function() {
        // cleanDirty(); // Now that everything is synced, change the dirty boolean to false
        console.log('Done syncing!');
        if (item) {
            item.dirty = false;
            persistence.flush();
        }
        callback();
    }, function() {
        console.log('Error syncing to server!');
        callback();
    });
}

// Load elements from localStorage (if used) and sync with server (if dontSync == false)
function load(callback, dontSync) {
    persistence.loadFromLocalStorage(function() { // if using localStorage
        console.log("All data loaded from localStorage!");
        if (window.navigator.onLine && !dontSync) {
            sync(callback); // Sync to server
        } else {
            callback();
        }
    });
}

// Save elements to localStorage (if used) and sync with server (if dontSync == false)
function save(callback, item, dontSync) {
    persistence.saveToLocalStorage(function() { // if using localStorage
        console.log("All data saved to localStorage!");
        if (window.navigator.onLine && !dontSync) {
            sync(callback, item); // Sync to server
        } else {
            callback();
        }
    });
}

function readOne(model, success) {
    load(function() {
        ItemEntity.load(model.id, function(item) {
            model.set(toJSON(item));
            success(model); // Success callback (will render the page)
        });
    }, 'dont-sync-please');
}

function readAll(model, success) {
    load(function() {
        var allItems = ItemEntity.all(); // Returns query collection containing all persisted instances
        allItems.list(function(results) { // Asynchronously fetches the results matching the query
            var resp = [];
            results.forEach(function(item) { // Iterate over the results
                resp.push(toJSON(item));
                // console.log(JSON.stringify(resp));
            });
            success(resp); // Success callback (will render the page)
        });
    });
}

function createAction(model, success) {
    var item = new ItemEntity();
    // The constructor automatically generates an id
    convertModel(item, model);
    item.deleted  = false;
    item.dirty    = true;
    // item.lastChange = getEpoch(new Date());
    persistence.add(item); // Add to database
    persistence.flush(); // Flush the new changes
    model.set(toJSON(item));

    // Save changes in localStorage (if using) and sync with server
    save(function() {
        success(model); // Success callback (will render the page)
    }, item, 'dont-sync-please');
}

function updateAction(model, success) {
    ItemEntity.load(model.id, function(item) {
        convertModel(item, model);
        item.deleted  = false;
        item.dirty    = true;
        // item.lastChange = getEpoch(new Date());
        persistence.flush(); // Flush the new changes
        model.set(toJSON(item));

        // Save changes in localStorage (if using) and sync with server
        save(function() {
            success(model); // Success callback (will render the page)
        }, item, 'dont-sync-please');
    });
}

function deleteAction(model, success) {
    ItemEntity.load(model.id, function(item) {
        item.deleted  = !item.deleted; // Allow undo
        item.dirty    = true;
        persistence.flush(); // Flush the new changes
        model.set(toJSON(item));

        // Save changes in localStorage (if using) and sync with server
        save(function() {
            success(model); // Success callback (will render the page)
        }, item, 'dont-sync-please');
    });
}

// Our Backbone.sync module (must be set on collections and models)
hybridSync = function(method, model, success, error) {
    switch (method) {
      case "read":
          if (model.id) {
              readOne(model, success); // Useful for show and edit views
          } else {
              readAll(model, success); // Useful for index view
          }
          break;
      case "create":
          createAction(model, success);
          break;
      case "update":
          updateAction(model, success);
          break;
      case "delete":
          deleteAction(model, success);
          break;
    }
};
