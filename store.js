(function() {
function namespace(root) {
    'use strict';

    var Promise = root.Promise;


    function IStore() {
    }
    IStore.prototype = {
        constructor: IStore,
        register: function(name, registry) {
            throw Error("Not Implemented Error");
        },
        getRegistry: function() {
            throw Error("Not Implemented Error");
        },
        getName: function() {
            throw Error("Not Implemented Error");
        },
        setNextPk: function(obj) {
            throw Error("Not Implemented Error");
        },
        getObjectAccessor: function() {
            throw Error("Not Implemented Error");
        },
        restoreObject: function(record) {
            throw Error("Not Implemented Error");
        },
        getInitObjectState: function(obj) {
            throw Error("Not Implemented Error");
        },
        getQueryEngine: function() {
            throw Error("Not Implemented Error");
        },
        syncDependencies: function(obj, old) {
            throw Error("Not Implemented Error");
        },
        getRequiredIndexes: function() {
            throw Error("Not Implemented Error");
        },
        addIndex: function(index) {
            throw Error("Not Implemented Error");
        },
        getLocalStore: function() {
            throw Error("Not Implemented Error");
        },
        getRemoteStore: function() {
            throw Error("Not Implemented Error");
        },
        get: function(pk) {
            throw Error("Not Implemented Error");
        },
        find: function(query, options) {
            throw Error("Not Implemented Error");
        },
        findList: function(query, options) {
            throw Error("Not Implemented Error");
        },
        add: function(obj, state) {
            throw Error("Not Implemented Error");
        },
        update: function(obj, state) {
            throw Error("Not Implemented Error");
        },
        delete: function(obj, state) {
            throw Error("Not Implemented Error");
        },
        compose: function(obj, allowedRelations, state) {
            throw Error("Not Implemented Error");
        },
        decompose: function(record, associatedObj) {
            throw Error("Not Implemented Error");
        },
        clean: function() {
            throw Error("Not Implemented Error");
        },
        isNull: function() {
            throw Error("Not Implemented Error");
        }
    };


    function AbstractStore() {
        this._name = null;
        observe(this, 'observed', DummyStoreObservable);
    }
    AbstractStore.prototype = clone({
        constructor: AbstractStore,
        register: function(name, registry) {
            var self = this;
            this._name = name;
            this._registry = registry;
            var deco = function(func) {
                return function() {
                    var obj = func.apply(this, arguments);
                    obj.getStore = function() { return self; };
                    return obj;
                };
            };
            this.getLocalStore().restoreObject = deco(this.getLocalStore().restoreObject);
        },
        getRegistry: function() {
            return this._registry;
        },
        getName: function() {
            return this._name;
        },
        getRequiredIndexes: function() {
            return [];
        },
        addIndex: function(index) {
        },
        compose: function(obj, allowedRelations, state) {
            return obj;
        },
        destroy: function() {
        },
        isNull: function() {
            return false;
        }
    }, Object.create(IStore.prototype));


    function CompositeStore(options) {
        AbstractStore.call(this);
        options || (options = {});

        if (options.remoteStore) {
            this._remoteStore = options.remoteStore;
        } else {
            if (options.mapper) {
                var pk = options.mapper.getObjectAccessor().pk;
            } else if (options.objectAccessor) {
                var pk = options.objectAccessor.pk;
            } else if (options.pk) {
                var pk = options.pk;
            } else {
                var pk = 'id';
            }
            var remoteStore = pk instanceof Array ? new DummyStore(options) : new AutoIncrementStore(options);
            this._remoteStore = withAspect(ObservableStoreAspect, remoteStore).init();
        }

        if (options.localStore) {
            this._localStore = options.localStore;
        } else {
            options.indexes = (options.indexes || []).concat(this.getRequiredIndexes());
            this._localStore = withAspect(ObservableStoreAspect, new MemoryStore(options)).init();
        }
    }
    CompositeStore.prototype = clone({
        constructor: CompositeStore,
        getLocalStore: function() {
            return this._localStore;
        },
        getRemoteStore: function() {
            return this._remoteStore;
        },
        getObjectAccessor: function() {
            return this._localStore.getObjectAccessor();
        },
        getDependencies: function() {
            return [this];
        },
        setNextPk: function(obj) {
            return this._localStore.setNextPk(obj);
        },
        getInitObjectState: function(obj) {
            return this._localStore.getInitObjectState(obj);
        },
        restoreObject: function(record) {
            return this._localStore.restoreObject(record);
        },
        getQueryEngine: function() {
            return this._localStore.getQueryEngine();
        },
        syncDependencies: function(obj, old) {
        },
        addIndex: function(index) {
            return this._localStore.addIndex(index);
        },
        decompose: function(record, associatedObj) {
            return this._localStore.decompose(record, associatedObj);
        },
        onConflict: function(newObj, oldObj) {
            return this._localStore.onConflict(newObj, oldObj);
        },
        pull: function(query, options) {  // fill, populate, pull (from remoteStore), fetch...
            typeof options === "undefined" && (options = {});
            typeof query === "undefined" && (query = {});
            var self = this;
            return when(this._prepareQuery(this._remoteStore.getQueryEngine(), query), function(query) {
                return when(this._remoteStore.find(query, options), function(objectList) {
                    return whenIter(objectList, function(obj, i) {
                        return when(self.decompose(obj), function(obj) {
                            objectList[i] = obj;
                        });
                    });
                });
            });
        },
        get: function(pkOrQuery) {
            return this._localStore.get(pkOrQuery);
        },
        save: function(obj) {
            return this.getObjectAccessor().pkExists(obj) ? this.update(obj) : this.add(obj);
        },
        add: function(obj, state) {
            return this._getTransaction().add(this, obj, function() {  // onCommit
                var dirty = this;
                var old = this.store.getObjectAccessor().getObjectState(dirty.obj);
                dirty.store.getObjectAccessor().delTmpPk(dirty.obj);
                return this.store.getRemoteStore().add(dirty.obj).then(function(obj) {
                    return when(dirty.store._localStore.update(obj), function(obj) {  // use decompose()
                        return when(dirty.store.syncDependencies(obj, old), function() {
                            return obj;
                        });
                    });
                });
            }, function() {  // onRollback
                return when(this.store._localStore.delete(this.obj));
            }, function() {  // onPending
                var dirty = this;
                this.store.getObjectAccessor().setTmpPk(dirty.obj);
                return when(dirty.store._localStore.add(dirty.obj), function(obj) {
                    dirty.obj = obj;
                    return when(obj);
                });
            }, function() {  // onAutoCommit
                var dirty = this;
                return when(dirty.store.getRemoteStore().add(dirty.obj), function(obj) {
                    // TODO: the obj can be an aggregate? Use decompose with merging strategy?
                    // Aggregate is the boundary of transaction.
                    // Usually aggregate uses optimistic offline lock of whole aggregate
                    // for concurrency control.
                    // So, we don't have to sync aggregate here, but we have to set at least PK and default values.
                    return when(dirty.store._localStore.add(dirty.obj), function(obj) {  // use decompose()
                        dirty.obj = obj;
                        return when(obj);
                    });
                });
            });
        },
        update: function(obj, state) {
            var self = this;
            var old = self.getInitObjectState(obj);
            return this._getTransaction().update(this, obj, old, function() {
                var dirty = this;
                return this.store.getRemoteStore().update(dirty.obj).then(function(obj) {
                    return dirty.store._localStore.update(obj);  // use decompose()
                });
            }, function() {
                var dirty = this;
                return when(this.store._localStore.update(clone(dirty.old, dirty.obj, function(obj, attr, value) {
                    return dirty.store.getObjectAccessor().setValue(obj, attr, value);
                })));
            });
        },
        delete: function(obj, state, remoteCascade) {
            var self = this;
            return self._getTransaction().delete(self, obj, function() {
                var dirty = this;
                if (remoteCascade) {
                    return when(dirty.obj);
                }
                return dirty.store.getRemoteStore().delete(dirty.obj);
            }, function() {
                var dirty = this;
                return when(dirty.store._localStore.add(dirty.obj));
            }).then(function(obj) {
                return when(self._localStore.delete(obj), function(obj) {
                    if (obj.observed) {
                        delete obj.observed().getObj;
                        delete obj.observed;
                    }
                    return obj;
                });
            });
        },
        /*
         * Implements pattern:
         * http://martinfowler.com/eaaCatalog/queryObject.html
         * Used MongoDB like syntax:
         * https://docs.mongodb.com/manual/reference/operator/query/
         */
        find: function(query, options) {
            // Signature similar to dojo.store.query();
            // Alternative: https://docs.mongodb.com/manual/reference/operator/meta/orderby/
            // store.find({$query: {}, $orderby: [{ age : -1 }]})
            var self = this;
            typeof query === "undefined" && (query = {});
            return when(this._prepareQuery(this._localStore.getQueryEngine(), query), function(query) {
                return self._localStore.find(query);
            });
        },
        _makeResult: function(reproducer, filter, objectList, subjects) {
            return new Result(this._localStore, reproducer, filter, objectList, subjects);
        },
        findList: function(query, options) {
            var self = this;
            typeof query === "undefined" && (query = {});
            return when(this._prepareQuery(this._localStore.getQueryEngine(), query), function(query) {
                return self._localStore.findList(query);
            });
        },
        _prepareQuery: function(queryEngine, query) {
            return query;
        },
        clean: function() {
            this._localStore.clean();
        },
        _getTransaction: function() {
            return this._registry.transaction;
        }
        /*
        bind: function(registry) {
            var BoundStore = function(registry) {
                this._registry = registry;
            };
            // TODO: use descriptors (or new interface) to delegate any setting (except registry) to prototype.
            BoundStore.prototype = this;
            return new BoundStore(registry);
        } */
    }, Object.create(AbstractStore.prototype));


    var ObservableStoreAspect = {
        init: function() {
            observe(this, 'observed', StoreObservable);
        },
        restoreObject: function(record) {
            var self = this;
            return when(__super__(ObservableStoreAspect, self).restoreObject.call(this, record), function(obj) {
                self.observed().notify('restoreObject', obj);
                return obj;
            });
        },
        add:  function(obj, state) {
            var self = this;
            return when(__super__(ObservableStoreAspect, self).add.call(this, obj), function(obj) {
                self.observed().notify('add', obj);
                return obj;
            });
        },
        update:  function(obj, state) {
            var self = this;
            var old = this.getInitObjectState(obj);
            return when(__super__(ObservableStoreAspect, self).update.call(this, obj), function(obj) {
                self.observed().notify('update', obj, old);
                return obj;
            });
        },
        delete:  function(obj, state, remoteCascade) {
            var self = this;
            return when(__super__(ObservableStoreAspect, self).delete.call(this, obj, state, remoteCascade), function(obj) {
                self.observed().notify('delete', obj);
                return obj;
            });
        },
        destroy: function() {
            var self = this;
            this.findList().forEach(function(obj) {
                self.observed().notify('destroy', obj);
            });
            __super__(ObservableStoreAspect, this).destroy.call(this);
        }
    };


    var PreObservableStoreAspect = {
        init: function() {
            observe(this, 'observed', StoreObservable);
        },
        add:  function(obj, state) {
            this.observed().notify('preAdd', obj);
            return __super__(PreObservableStoreAspect, this).add.call(this, obj);
        },
        update:  function(obj, state) {
            var old = this.getInitObjectState(obj);
            this.observed().notify('preUpdate', obj, old);
            return __super__(PreObservableStoreAspect, this).update.call(this, obj);
        },
        delete:  function(obj, state, remoteCascade) {
            this.observed().notify('preDelete', obj);
            return __super__(PreObservableStoreAspect, this).delete.call(this, obj, state, remoteCascade);
        }
    };


    var CircularReferencesStoreAspect = {
        add: function(obj, state) {
            state = state || new State();
            if (state.isVisited(this, obj)) { return  when(obj);  };  // It's circular references. Skip it.
            return __super__(CircularReferencesStoreAspect, this).add.call(this, obj, state);
        },
        update: function(obj, state) {
            state = state || new State();
            if (state.isVisited(this, obj)) { return  when(obj);  };  // It's circular references. Skip it.
            return __super__(CircularReferencesStoreAspect, this).update.call(this, obj, state);
        },
        delete: function(obj, state, remoteCascad) {
            state = state || new State();
            if (state.isVisited(this, obj)) { return  when(obj);  };  // It's circular references. Skip it.
            return __super__(CircularReferencesStoreAspect, this).delete.call(this, obj, state, remoteCascad);
        }
    };


    var CheckReferentialIntegrityStoreAspect = {
        init: function() {
        },
        add:  function(obj, state) {
            var self = this;
            return when(this._checkReferentialIntegrity(obj), function() {
                return __super__(PreObservableStoreAspect, self).add.call(self, obj);
            });
        },
        update:  function(obj, state) {
            var self = this;
            return when(this._checkReferentialIntegrity(obj), function() {
                return __super__(PreObservableStoreAspect, self).update.call(self, obj);
            });
        },
        delete:  function(obj, state, remoteCascade) {
            var self = this;
            return when(this._checkRelatedReferentialIntegrity(obj), function() {
                return __super__(PreObservableStoreAspect, self).delete.call(self, obj, state, remoteCascade);
            });
        },
        _checkReferentialIntegrity: function(obj) {
            var self = this;
            return whenIter(keys(this.relations.foreignKey), function(relationName) {
                var relation = self.relations.foreignKey[relationName];
                var relatedStore = relation.getRelatedStore();
                var value = relation.getValue(obj);
                var checkValue = value.filter(function(val) { return !!val; });
                if (!checkValue.length) { return; }
                return when(relatedStore.findList(relation.getRelatedQuery(obj)), function(relatedObjectList) {
                    var relatedObj = relatedObjectList[0];
                    if (typeof relatedObj === "undefined") {
                        throw Error("Referential Integrity Error! Trying to add object with non-added relations!");
                    }
                    return obj;
                });
            });
        },
        _checkRelatedReferentialIntegrity: function(obj) {
            var self = this;
            return whenIter(keys(this.relations.oneToMany), function(relationName) {
                var relation = self.relations.oneToMany[relationName];
                var relatedStore = relation.getRelatedStore();
                var value = relation.getValue(obj);
                var checkValue = value.filter(function(val) { return !!val; });
                if (!checkValue.length) { return; }
                return when(relatedStore.findList(relation.getRelatedQuery(obj)), function(relatedObjectList) {
                    if (relatedObjectList.length) {
                        throw Error("Referential Integrity Error! Trying to delete object with non-deleted relations!");
                    }
                    return obj;
                });
            });
        }
    };


    var RelationalStoreAspect = {
        init: function(relations) {
            var self = this;
            typeof relations === "undefined" && (relations = {});
            this._initRelations(relations);
            this.getRequiredIndexes().forEach(function(index) {
                self.addIndex(index);
            });
        },
        getRequiredIndexes: function() {
            var indexes = __super__(RelationalStoreAspect, this).getRequiredIndexes.call(this).slice();
            if (!this.relations) { return indexes; } // Called from CompositeStore()
            for (var relationName in this.relations.foreignKey) {
                var fields = this.relations.foreignKey[relationName].getField();
                for (var i = 0; i < fields.length; i++) {
                    if (indexes.indexOf(fields[i]) === -1) {
                        indexes.push(fields[i]);
                    }
                }
            }
            return indexes;
        },
        register: function(name, registry) {
            var self = this;
            __super__(RelationalStoreAspect, self).register.call(self, name, registry);
            self._registry.keys().forEach(function(relatedStoreName) {
                self._setupReverseRelations(self._registry.get(relatedStoreName));
            });
        },
        add: function(obj, state) {
            var self = this;
            return when(__super__(RelationalStoreAspect, self).add.call(self, obj, state), function(obj) {
                return self._propagateBottomUpRelations('onAdd', obj, obj, state).then(function() {
                    return obj;
                });
            });
        },
        update: function(obj, state) {
            var self = this;
            var old = self.getInitObjectState(obj);
            return when(__super__(RelationalStoreAspect, self).update.call(self, obj, state), function(obj) {
                return self._propagateTopDownRelations('onUpdate', obj, old, state).then(function() {
                    return obj;
                });
            });
        },
        delete: function(obj, state, remoteCascade) {
            var self = this;
            return when(self._propagateTopDownRelations('onDelete', obj, obj, state), function() {
                return __super__(RelationalStoreAspect, self).delete.call(self, obj, state, remoteCascade);
            });
        },
        getDependencies: function() {
            var queue = [this];
            for (var i = 0; i < queue.length; i++) {
                var store = queue[i];
                for (var relationName in store.relations.foreignKey) {
                    var relation = store.relations.foreignKey[relationName];
                    var relatedStore = relation.getRelatedStore();
                    if (queue.indexOf(relatedStore) === -1) {
                        queue.push(relatedStore);
                    }
                }
            }
            return queue;
        },
        /*
         * Returns composition of related objects.
         */
        compose: function(obj, allowedRelations, state) {
            return new Compose(this, obj, allowedRelations, state).compute();
        },
        /*
         * Load related stores from composition of object.
         */
        decompose: function(record, associatedObj) {
            return new Decompose(this, record, associatedObj).compute();
        },
        _prepareQuery: function(queryEngine, query) {
            var self = this;
            return when(new PrepareRelationalQuery(queryEngine, query, this).compute(), function(queryRelational) {
                return __super__(RelationalStoreAspect, self)._prepareQuery.call(self, queryEngine, queryRelational);
            });
        },
        getRelation: function(name) {
            for (var relationType in this.relations) {
                if (name in this.relations[relationType]) {
                    return this.relations[relationType][name];
                }
            }
        },
        relationIsUsedByM2m: function(relationName) {
            for (var m2mRelationName in this.relations.manyToMany) {
                if (this.relations.manyToMany[m2mRelationName].relation === relationName) { return true; }
            }
            return false;
        },
        _initRelations: function(relations) {
            this.relations = relations ? relations : {};
            var classMapping = {
                foreignKey: ForeignKey,
                oneToMany: OneToMany,
                manyToMany: ManyToMany
            };
            for (var type in classMapping) {
                if (!(type in this.relations)) {
                    this.relations[type] = {};
                }
                for (var name in this.relations[type]) {
                    var params = this.relations[type][name];
                    params['name'] = name;
                    params['store'] = this;
                    this.relations[type][name] = new classMapping[type](params);
                }
            }
        },
        syncDependencies: function(obj, old) {
            var self = this;
            return when(this._syncRelations(obj, old), function() {
                return __super__(RelationalStoreAspect, self).syncDependencies.call(obj, old);
            });
        },
        _syncRelations: function(obj, old) {
            var self = this;
            return new Iterator(keys(this.relations.oneToMany)).onEach(function(relationName, resolve, reject) {
                var relation = self.relations.oneToMany[relationName];
                var value = relation.getValue(obj);
                var oldValue = relation.getValue(old);
                if (!arrayEqual(value, oldValue)) {
                    var relatedStore = relation.getRelatedStore();
                    when(relatedStore.findList(relation.getRelatedQuery(old)), function(relatedObjectList) {
                        new Iterator(relatedObjectList).onEach(function(relatedObj, resolve, reject) {
                            relatedStore.getObjectAccessor().setValue(relatedObj, relation.getRelatedField(), value);
                            when(relatedStore._localStore.update(relatedObj), resolve, reject);
                        }).iterate().then(resolve, reject);
                    });
                }
            }).iterate();
        },
        _setupReverseRelations: function(store) {
            for (var relationName in store.relations.foreignKey) {
                var relation = store.relations.foreignKey[relationName];
                relation.setupReverseRelation();
            }
        },
        _propagateTopDownRelations: function(onAction, obj, old, state) {
            var self = this;
            return new Iterator(keys(self.relations.oneToMany)).onEach(function(relationName, resolve, reject) {
                self._propagateByRelation(onAction, obj, old, self.relations.oneToMany[relationName], state).then(resolve, reject);
            }).iterate().then(function() {
                return new Iterator(keys(self.relations.manyToMany)).onEach(function(relationName, resolve, reject) {
                    self._propagateByM2m(onAction, obj, old, self.relations.manyToMany[relationName], state).then(resolve, reject);
                }).iterate();
            });
        },
        _propagateBottomUpRelations: function(onAction, obj, old, state) {
            var self = this;
            return new Iterator(keys(self.relations.foreignKey)).onEach(function(relationName, resolve, reject) {
                self._propagateByRelation(onAction, obj, old, self.relations.foreignKey[relationName], state).then(resolve, reject);
            }).iterate().then(function() {
                return new Iterator(keys(self.relations.manyToMany)).onEach(function(relationName, resolve, reject) {
                    self._propagateByM2m(onAction, obj, old, self.relations.manyToMany[relationName], state).then(resolve, reject);
                }).iterate();
            });
        },
        _propagateByRelation: function(onAction, obj, old, relation, state) {
            if (!(onAction in relation)) {
                return Promise.resolve();
            }
            var relatedStore = relation.getRelatedStore();
            var query = relation.getRelatedQuery(obj);
            return when(relatedStore.findList(query), function(relatedObjectList) {
                return new Iterator(relatedObjectList).onEach(function(relatedObj, resolve, reject) {
                    return new Iterator(toArray(relation[onAction])).onEach(function(action, resolve, reject) {
                        action(relatedObj, obj, old, relation, state).then(resolve, reject);
                    }).iterate().then(
                        resolve, reject
                    );
                }).iterate();
            });
        },
        _propagateByM2m: function(onAction, obj, old, m2mRelation, state) {
            if (!(onAction in m2mRelation)) {
                return;
            }
            var relatedStore = m2mRelation.getRelatedStore();
            var relation = this.relations.oneToMany[m2mRelation.relation];
            var query = m2mRelation.getRelatedQuery(obj);
            return when(relatedStore.findList(query), function(relatedObjectList) {
                return new Iterator(relatedObjectList).onEach(function(relatedObj, resolve, reject) {
                    return new Iterator(toArray(m2mRelation[onAction])).onEach(function(action, resolve, reject) {
                        action(relatedObj, obj, old, relation, state).then(resolve, reject);
                    }).iterate().then(
                        resolve, reject
                    );
                }).iterate();
            });
        }
    };


    /*
     * This class implements the pattern Repository:
     * http://martinfowler.com/eaaCatalog/repository.html
     */
    function Store(options) {
        options || (options = {});
        CompositeStore.call(this, options);
        RelationalStoreAspect.init.call(this, options.relations);
        ObservableStoreAspect.init.call(this);
    }
    Store.prototype = clone({
        constructor: Store
    }, withMixins(CircularReferencesStoreAspect, ObservableStoreAspect, RelationalStoreAspect, CompositeStore.prototype));


    function AbstractRelation(params) {
        if (params.field) { params.field = toArray(params.field); }
        if (params.relatedField) { params.relatedField = toArray(params.relatedField); }
        clone(params, this);
    }
    AbstractRelation.prototype = {
        constructor: AbstractRelation,
        getField: function() {
            return this.field;
        },
        getRelatedField: function() {
            return this.relatedField;
        },
        getValue: function(obj) {
            return this.store.getObjectAccessor().getValue(obj, this.getField());
        },
        getRelatedValue: function(relatedObj) {
            return this.getRelatedStore().getObjectAccessor().getValue(relatedObj, this.getRelatedField());
        },
        getQuery: function(relatedObj) {
            var query = {},
                field = this.getField(),
                relatedValue = this.getRelatedValue(relatedObj);
            for (var i = 0; i < field.length; i++) {
                query[field[i]] = {'$eq': relatedValue[i]};
            }
            return query;
        },
        getRelatedQuery: function(obj) {
            var query = {},
                relatedField = this.getRelatedField(),
                value = this.getValue(obj);
            for (var i = 0; i < relatedField.length; i++) {
                query[relatedField[i]] = {'$eq': value[i]};
            }
            return query;
        },
        setupReverseRelation: function() {},
        getRelatedStore: function() {
            return this.store.getRegistry().get(this.relatedStore);
        },
        getRelatedRelation: function() {
            return this.getRelatedStore().getRelation(this.relatedName);
        }
    };


    function ForeignKey(params) {
        AbstractRelation.call(this, params);
        if (!this.relatedName) {
            this.relatedName = this.store.getName() + 'Set';
        }
    }
    ForeignKey.prototype = clone({
        constructor: ForeignKey,
        setupReverseRelation: function() {
            if (!this.store.getRegistry().has(this.relatedStore)) {
                return;
            }
            if (this.relatedName in this.getRelatedStore().relations.oneToMany) {
                return;
            }
            var relatedParams = {
                field: this.relatedField,
                relatedField: this.field,
                relatedStore: this.store.getName(),
                relatedName: this.name,
                name: this.relatedName,
                store: this.getRelatedStore()
            };
            if ('onUpdate' in this) {
                relatedParams['onUpdate'] = this['onUpdate'];
            };
            if ('onDelete' in this) {
                relatedParams['onDelete'] = this['onDelete'];
            };
            this.getRelatedStore().relations.oneToMany[relatedParams.name] = new OneToMany(relatedParams);
        }
    }, Object.create(AbstractRelation.prototype));


    function OneToMany(params) {
        AbstractRelation.call(this, params);
    }
    OneToMany.prototype = clone({
        constructor: OneToMany
    }, Object.create(AbstractRelation.prototype));


    function ManyToMany(params) {
        AbstractRelation.call(this, params);
    }
    ManyToMany.prototype = clone({
        constructor: ManyToMany,
        getField: function() {
            return this.store.relations.oneToMany[this.relation].getField();
        },
        getRelatedField: function() {
            return this.getRelatedStore().relations.oneToMany[this.relatedRelation].getField();
        },
        getQuery: function(relatedObj) {
            var query = {},
                subQuery = {},
                relatedField = this.getRelatedField(),
                relatedValue = this.getRelatedValue(relatedObj);
            for (var i = 0; i < relatedField.length; i++) {
                subQuery[relatedField[i]] = {'$eq': relatedValue[i]};
            }
            query[this.name] = {'$rel': subQuery};
            return query;
        },
        getRelatedQuery: function(obj) {
            var query = {},
                subQuery = {},
                field = this.getField(),
                value = this.getValue(obj);
            for (var i = 0; i < field.length; i++) {
                subQuery[field[i]] = {'$eq': value[i]};
            }
            query[this.store.getRelation(this.relation).relatedName] = {'$rel': subQuery};
            subQuery = query;
            query = {};
            query[this.relatedRelation] = {'$rel': subQuery};
            return query;
        },
        getRelatedRelation: function() {
            return;
        }
    }, Object.create(AbstractRelation.prototype));


    function AbstractQueryEngine() {
        this._operators = {};
    }
    AbstractQueryEngine.prototype = {
        constructor: AbstractQueryEngine,
        register: function(operatorName, operatorCallable, properties) {
            properties = clone(properties, {
                indexable: false,
                compound: false
            });
            for (var i in properties) {
                if (properties.hasOwnProperty(i)) {
                    operatorCallable[i] = properties[i];
                }
            }
            this._operators[operatorName] = operatorCallable;
            return operatorCallable;
        },
        get: function(operatorName) {
            return this._operators[operatorName];
        },
        has: function(operatorName) {
            return operatorName in this._operators;
        },
        isCompound: function(operatorName) {
            return this._operators[operatorName].compound;
        },
        isIndexable: function(operatorName) {
            return this._operators[operatorName].indexable;
        },
        execute: function(query, objectAccessor, context) {
            throw Error("Not Implemented Error!");
        }
    };


    function SimpleQueryEngine() {
        AbstractQueryEngine.call(this);
    }
    SimpleQueryEngine.prototype = clone({
        constructor: SimpleQueryEngine,
        execute: function(query, objectAccessor, context) {
            var result = true;
            for (var left in query) {
                if (isSpecialAttr(left)) { continue; }
                var right = query[left];
                if (this.has(left)) {
                    result = result && this.get(left).call(this, right, objectAccessor, context);
                } else {
                    result = result && this._executeRight(left, right, objectAccessor, context);
                }
                if (!result) {
                    return result;
                }
            }
            return result;
        },
        _executeRight: function(left, right, objectAccessor, context) {
            var result = true;
            for (var key in right) {
                result = result && this._lookupThroughAggregate(left, key, right[key], objectAccessor, context);
                if (!result) {
                    return result;
                }
            }
            return result;
        },
        _lookupThroughAggregate: function(path, op, required, objectAccessor, context) {
            if (path.indexOf('.') !== -1) {
                var result = false;
                var pathParts = path.split('.');
                var field = pathParts.shift();
                var subPath = pathParts.join('.');
                var subContexts = objectAccessor.getValue(context, field);
                subContexts = toArray(subContexts);
                for (var i = 0; i < subContexts.length; i++) {
                    var subContext = subContexts[i];
                    if (!subContext) {
                        continue;
                    }
                    result = result || this._lookupThroughAggregate(subPath, op, required, objectAccessor, subContext);
                    if (result) {
                        return result;
                    }
                }
                return result;
            } else {
                return this.get(op).call(this, [path, required], objectAccessor, context);
            }
        }
    }, Object.create(AbstractQueryEngine.prototype));


    var simpleQueryEngine = new SimpleQueryEngine();

    simpleQueryEngine.register('$query', function(operands, objectAccessor, obj) {
        return this.execute(operands, objectAccessor, obj);
    }, {indexable: true});
    simpleQueryEngine.register('$subjects', function(operands, objectAccessor, obj) {
        return true;
    }, {indexable: true});
    simpleQueryEngine.register('$orderby', function(operands, objectAccessor, obj) {
        return true;
    }, {indexable: true, compound: true});
    simpleQueryEngine.register('$limit', function(operands, objectAccessor, obj) {
        return true;
    }, {indexable: true});
    simpleQueryEngine.register('$offset', function(operands, objectAccessor, obj) {
        return true;
    }, {indexable: true});
    simpleQueryEngine.register('$and', function(operands, objectAccessor, obj) {
        var result = true;
        for (var i = 0; i < operands.length; i++) {
            result = result && this.execute(operands[i], objectAccessor, obj);
            if (!result) {
                return result;
            }
        };
        return result;
    }, {indexable: true, compound: true});
    simpleQueryEngine.register('$or', function(operands, objectAccessor, obj) {
        var result = false;
        for (var i = 0; i < operands.length; i++) {
            result = result || this.execute(operands[i], objectAccessor, obj);
            if (result) {
                return result;
            }
        };
        return result;
    }, {compound: true});
    simpleQueryEngine.register('$in', function(operands, objectAccessor, obj) {
        var result = false,
            field = operands[0],
            values = operands[1];
        for (var i = 0; i < values.length; i++) {
            result = result || this.get('$eq').call(this, [field, values[i]], objectAccessor, obj);
            if (result) {
                return result;
            }
        }
        return result;
    });
    simpleQueryEngine.register('$eq', function(operands, objectAccessor, obj) {
        var field = operands[0],
            value = operands[1];
        return objectAccessor.getValue(obj, field) == value;
    }, {indexable: true});
    simpleQueryEngine.register('$ne', function(operands, objectAccessor, obj) {
        var field = operands[0],
            value = operands[1];
        return objectAccessor.getValue(obj, field) != value;
    });
    simpleQueryEngine.register('$callable', function(operands, objectAccessor, obj) {
        if (typeof operands === "function") {
            var func = operands;
            return func(obj);
        }
        var field = operands[0],
            func = operands[1];
        return func(objectAccessor.getValue(obj, field), obj, field);
    });


    function DjangoFilterQueryEngine() {
        AbstractQueryEngine.call(this);
    }
    DjangoFilterQueryEngine.prototype = clone({
        constructor: DjangoFilterQueryEngine,
        execute: function(query, objectAccessor, context) {
            var result = {};
            for (var left in query) {
                var right = query[left];
                if (this.has(left)) {
                    clone(this.get(left).call(this, right, objectAccessor, context), result);
                } else {
                    clone(this._executeRight(left, right, objectAccessor, context), result);
                }
            }
            return result;
        },
        _executeRight: function(left, right, objectAccessor, context) {
            var result = {};
            for (var key in right) {
                clone(this.get(key).call(this, [left, right[key]], objectAccessor, context), result);
            }
            return result;
        }
    }, Object.create(AbstractQueryEngine.prototype));


    var djangoFilterQueryEngine = new DjangoFilterQueryEngine();


    djangoFilterQueryEngine.register('$query', function(operands, objectAccessor, obj) {
        return this.execute(operands, objectAccessor, obj);
    }, {indexable: true});
    djangoFilterQueryEngine.register('$subjects', function(operands, objectAccessor, obj) {
        return {};
    }, {indexable: true});
    djangoFilterQueryEngine.register('$orderby', function(operands, objectAccessor, obj) {
        return {};
    }, true);
    djangoFilterQueryEngine.register('$limit', function(operands, objectAccessor, obj) {
        return {};
    }, {indexable: true});
    djangoFilterQueryEngine.register('$offset', function(operands, objectAccessor, obj) {
        return {};
    }, {indexable: true});
    djangoFilterQueryEngine.register('$and', function(operands, objectAccessor, context) {
        var result = {};
        for (var i in operands) {
            clone(this.execute(operands[i], objectAccessor, context), result);
        };
        return result;
    }, {indexable: true, compound: true});
    djangoFilterQueryEngine.register('$or', function(operands, objectAccessor, context) {
        throw Error("Not Supported!");
    }, {compound: true});
    djangoFilterQueryEngine.register('$callable', function(operands, objectAccessor, context) {
        throw Error("Not Supported!");
    });
    djangoFilterQueryEngine.register('$eq', function(operands, objectAccessor, context) {
        var result = {},
            field = operands[0],
            value = operands[1];
        if (typeof value === "undefined" || value === null) {
            field += '__isnull';
            value = true;
        }
        result[field] = value;
        return result;
    }, {indexable: true});
    djangoFilterQueryEngine.register('$ne', function(operands, objectAccessor, context) {
        var result = {},
            field = operands[0],
            value = operands[1];
        if (typeof value === "undefined" || value === null) {
            field += '__isnull';
            value = false;
        } else {
            field += '__ne';
        }
        result[field] = value;
        return result;
    });
    djangoFilterQueryEngine.register('$rel', function(operands, objectAccessor, context) {
        var result = {},
            prefix = operands[0],
            subQuery = operands[1];
        var subResult = this.execute(subQuery, objectAccessor, context);
        for (i in subResult) {
            result[prefix + '__' + i] = subResult[i];
        }
        return result;
    });


    function ObjectAccessor(pk, setter, getter, deleter) {
        this.pk = pk || 'id';
        this.setter = setter || function(obj, attr, value) {
            if (typeof obj.observed === "function") {
                obj.observed().set(attr, value);
            } else {
                obj[attr] = value;
            }
        };
        this.getter = getter || function(obj, attr) {
            if (typeof obj.observed === "function") {
                var value = obj.observed().get(attr);
            } else {
                var value = obj[attr];
            }
            if (typeof value === "function") {
                value = value.call(obj);
            }
            return value;
        };
        this.deleter = deleter || function(obj, attr) {
            if (typeof obj.observed === "function") {
                obj.observed().del(attr);
            } else {
                delete obj[attr];
            }
        };
    }
    ObjectAccessor.prototype = {
        constructor: ObjectAccessor,
        _tmpPkPrefix: '__tmp_',
        getPk: function(obj) {
            return this.getValue(obj, this.pk);
        },
        setPk: function(obj, value) {
            this.setValue(obj, this.pk, value);
        },
        delPk: function(obj) {
            this.delValue(obj, this.pk);
        },
        getValue: function(obj, field) {
            if (field instanceof Array) {
                var value = [];
                for (var i = 0; i < field.length; i++) {
                    value.push(this.getter(obj, field[i]));
                }
                return value;
            } else {
                return this.getter(obj, field);
            }
        },
        setValue: function(obj, field, value) {
            if (field instanceof Array) {
                for (var i = 0; i < field.length; i++) {
                    this.setter(obj, field[i], value[i]);
                }
            } else {
                this.setter(obj, field, value);
            }
        },
        delValue: function(obj, field) {
            if (field instanceof Array) {
                for (var i = 0; i < field.length; i++) {
                    this.deleter(obj, field[i]);
                }
            } else {
                this.deleter(obj, field);
            }
        },
        getObjectState: function(obj) {
            return clone(obj, {});
        },
        pkExists: function(obj) {
            return toArray(this.getPk(obj)).filter(function(val) {
                return val !== null && typeof val !== "undefined";
            }).length === toArray(this.pk).length;
        },
        setTmpPk: function(obj) {
            var pkValue = this.getPk(obj);
            if (pkValue instanceof Array) {
                for (var i = 0; i < pkValue.length; i++) {
                    if (typeof pkValue[i] === "undefined") {
                        pkValue[i] = this._makeTmpId();
                    }
                }
            } else {
                if (typeof pkValue === "undefined") {
                    pkValue = this._makeTmpId();
                }
            }
            this.setPk(obj, pkValue);
        },
        delTmpPk: function(obj) {
            var pk = toArray(this.pk);
            for (var i = 0; i < pk.length; i++) {
                var field = pk[i];
                if (this._isTmpId(this.getValue(obj, field))) {
                    this.delValue(obj, field);
                }
            }
        },
        _makeTmpId: function() {
            ObjectAccessor._counter || (ObjectAccessor._counter = 0);
            return this._tmpPkPrefix + (++ObjectAccessor._counter);
        },
        _isTmpId: function(value) {
            return typeof value === "string" && value.indexOf(this._tmpPkPrefix) === 0;
        }
    };


    function IndexFinder(memoryStore) {
        this._memoryStore = memoryStore;
    }
    IndexFinder.prototype = {
        constructor: IndexFinder,
        '$eq': function(field, value) {
            if (this._memoryStore.indexes[field] && value in this._memoryStore.indexes[field]) {
                return this._memoryStore.indexes[field][value].slice();
            }
            return undefined;
        }
    };


    function AbstractQueryWalker(queryEngine, query) {
        if (!('$query' in query)) {
            // Don't clone query into itself if you want to keep all references to the root.
            // We have to keep all references to the same logical level.
            // A component of the query can be changeable by event.
            // See emulatedRelation._emulateRelation() for more info.
            query = {'$query': query};
        }
        this._query = query;
        this._promises = [];
        this._queryEngine = queryEngine;
    }
    AbstractQueryWalker.prototype = {
        constructor: AbstractQueryWalker,
        _visitors: {
            compoundOperator: {
                accept: function(owner, left, right) {
                    return right instanceof Array && owner._queryEngine.isCompound(left);
                },
                visit: function(owner, left, right, query) {
                    for (var i = 0; i < right.length; i++) {
                        owner._walkQuery(right[i]);
                    }
                }
            },
            nestedQuery: {
                accept: function(owner, left, right) {
                    return isPlainObject(right) && !(right instanceof Array);
                },
                visit: function(owner, left, right, query) {
                    owner._walkQuery(right);
                }
            },
            promisedOperand: {
                accept: function(owner, left, right) {
                    return right && typeof right.then === "function";
                },
                visit: function(owner, left, right, query) {
                    owner._promises.push(right);
                    when(right, function(right) {
                        query[left] = right;
                    });
                }
            }
        },
        _activeVisitors: [
            'compoundOperator',
            'nestedQuery'
            // 'promisedOperand'
        ],
        compute: function() {
            throw Error("Not Implemented Error!");
        },
        _walkQuery: function(query) {
            for (var i = 0; i < this._activeVisitors.length; i++) {
                var visitor = this._visitors[this._activeVisitors[i]];
                for (var left in clone(query, {})) {
                    if (isSpecialAttr(left)) { continue; }
                    var right = query[left];
                    if (visitor.accept(this, left, right)) {
                        visitor.visit(this, left, right, query);
                    }
                }
            }
        },
        _walkQueryPromisable: function(query) {
            this._walkQuery(query);
            if (this._promises.length) {
                return Promise.all(this._promises).then(function() {
                    // Handle the query again?
                    return query;
                });
            } else {
                return query;
            }
        }
    };


    function PrepareQuery(queryEngine, query) {
        AbstractQueryWalker.call(this, queryEngine, query);
    }
    PrepareQuery.prototype = clone({
        constructor: PrepareQuery,
        _visitors: clone(AbstractQueryWalker.prototype._visitors, {
            operatorInShortForm: {
                accept: function(owner, left, right) {
                    return !owner._queryEngine.has(left);
                },
                visit: function(owner, left, right, query) {
                    if (typeof right === "function") {
                        query[left] = {'$callable': right};
                    } else if (!isPlainObject(right)) {
                        query[left] = {'$eq': right};
                    }
                }
            }
        }),
        _activeVisitors: [
            'operatorInShortForm',
            'compoundOperator',
            'nestedQuery',
            'promisedOperand'
        ],
        compute: function() {
            return this._walkQueryPromisable(this._query);
        }
    }, Object.create(AbstractQueryWalker.prototype));


    function PrepareRelationalQuery(queryEngine, query, store) {
        AbstractQueryWalker.call(this, queryEngine, query);
        this._store = store;
        this._subjects = [];
    }
    PrepareRelationalQuery.prototype = clone({
        constructor: PrepareRelationalQuery,
        _visitors: clone(AbstractQueryWalker.prototype._visitors, {
            relationInShorForm: {
                accept: function(owner, left, right) {  // relation by dot
                    return left.indexOf('.') > -1 && owner._store.getRelation(left.split('.')[0]);
                },
                visit: function(owner, left, right, query) {
                    delete query[left];
                    var leftParts = left.split('.');
                    left = leftParts.shift();
                    var rightPart = {};
                    rightPart[leftParts.join('.')] = right;
                    right = {'$rel': rightPart};
                    query[left] = right;
                }
            },
            valueIsModelInstance: {
                accept: function(owner, left, right) {  // relation by instance of model
                    return isModelInstance(right) && owner._store.getRelation(left);
                },
                visit: function(owner, left, right, query) {
                    delete query[left];
                    var relation = owner._store.getRelation(left);
                    clone(relation.getQuery(right), query);
                }
            },
            emulatedRelation: {
                accept: function(owner, left, right) {
                    return isPlainObject(right) && '$rel' in right && !owner._queryEngine.has('$rel');
                },
                visit: function(owner, left, right, query) {
                    delete query[left];
                    var andClause = [];
                    for (var opName in right) {
                        var relatedQuery = right[opName];
                        var relationName = left;
                        if (relationName in owner._store.relations.foreignKey) {
                            andClause.push(this._emulateRelation(owner, relationName, relatedQuery));
                        } else if (relationName in owner._store.relations.oneToMany) {
                            andClause.push(this._emulateRelation(owner, relationName, relatedQuery));
                        } else if (relationName in owner._store.relations.manyToMany) {
                            andClause.push(this._emulateM2mRelation(owner, relationName, relatedQuery));
                        } else {
                            throw Error('Unknown relation: ' + relationName);
                        }
                    }
                    query['$and'] = andClause;
                },
                _emulateM2mRelation: function(owner, relationName, relatedQuery) {
                    var m2mRelation = owner._store.relations.manyToMany[relationName];
                    var relatedStore = m2mRelation.getRelatedStore();
                    var relatedRelation = relatedStore.relations.oneToMany[m2mRelation.relatedRelation];
                    var query = {};
                    query[relatedRelation.relatedName] = {'$rel': relatedQuery};
                    return this._emulateRelation(owner, m2mRelation.relation, query);  // 'o2m'
                },
                _emulateRelation: function(owner, relationName, relatedQuery) {
                    var relation = owner._store.getRelation(relationName);
                    var relatedStore = relation.getRelatedStore();
                    var relatedQueryResult = relatedStore.find(relatedQuery);
                    return when(relatedQueryResult, function(relatedQueryResult) {
                        var orClause = relatedQueryResult.map(function(obj) { return relation.getQuery(obj); });
                        // TODO: remove duplicates from orClause for case of o2m?
                        owner._subjects.push(orClause);
                        return {'$or': orClause};
                    });
                }
            }
        }),
        _activeVisitors: [
            'relationInShorForm',
            'valueIsModelInstance',
            'emulatedRelation',
            'compoundOperator',
            'nestedQuery',
            'promisedOperand'
        ],
        compute: function() {
            var self = this;
            return when(this._walkQueryPromisable(this._query), function(query) {
                if (!('$subjects' in query)) {
                    query['$subjects'] = [];
                }
                Array.prototype.push.apply(query['$subjects'], self._subjects);
                return query;
            });
        }
    }, Object.create(AbstractQueryWalker.prototype));


    function GetInitObjectList(queryEngine, query, memoryStore) {
        AbstractQueryWalker.call(this, queryEngine, query);
        this._memoryStore = memoryStore;
        this._indexes = [];
        this._indexIsPossible = true;
    }
    GetInitObjectList.prototype = clone({
        constructor: GetInitObjectList,
        _visitors: clone(AbstractQueryWalker.prototype._visitors, {
            possibilityOfIndexUsage: {
                accept: function(owner, left, right) {
                    return owner._queryEngine.has(left) && !owner._queryEngine.isIndexable(left);
                },
                visit: function(owner, left, right, query) {
                    owner._indexIsPossible = false;
                }
            },
            index: {
                accept: function(owner, left, right) {
                    // Index can't to work with $or, $in and $callable.
                    // TODO: It's possible to optimize and check only first level of query object.
                    return isPlainObject(right) && '$eq' in right && left in owner._memoryStore.indexes;
                },
                visit: function(owner, left, right, query) {
                    owner._indexes.push([left, '$eq', right['$eq']]);
                }
            }
        }),
        _activeVisitors: [
            'compoundOperator',
            'nestedQuery',
            'possibilityOfIndexUsage',
            'index'
        ],
        compute: function() {
            this._walkQuery(this._query);
            return this._getObjectList();
        },
        _findBestIndex: function() {
            var indexes = [];
            for (var i = 0; i < this._indexes.length; i++) {
                var field = this._indexes[i][0],
                    opName = this._indexes[i][1],
                    value = this._indexes[i][2];
                var indexValue = new IndexFinder(this._memoryStore)[opName](field, value);
                if (typeof indexValue !== "undefined") {
                    indexes.push(indexValue);
                }
            }
            if (!indexes.length) {
                return null;
            }
            indexes.sort(function(a, b) { return a.length - b.length; });
            return indexes[0];
        },
        _getObjectList: function() {
            // console.debug(this._indexIsPossible, this._indexes, this._query, this._memoryStore.indexes);
            if (this._indexIsPossible) {
                var bestIndex = this._findBestIndex();
                if (bestIndex !== null) {
                    // console.debug('!!!!!', bestIndex);
                    if (bestIndex.length && (bestIndex.length / bestIndex.length) < 2) {
                        return bestIndex;
                    }
                }
            }
            return this._memoryStore.objectList;
        }
    }, Object.create(AbstractQueryWalker.prototype));


    function PkRequired(message) {
        this.name = 'PkRequired';
        this.message = message || "Primary key is required!";
        this.stack = (new Error()).stack;
    }
    PkRequired.prototype = Object.create(Error.prototype);
    PkRequired.prototype.constructor = PkRequired;


    function ObjectAlreadyAdded(message) {
        this.name = 'ObjectAlreadyAdded';
        this.message = message || "Only single instance of object can be added into the store!";
        this.stack = (new Error()).stack;
    }
    ObjectAlreadyAdded.prototype = Object.create(Error.prototype);
    ObjectAlreadyAdded.prototype.constructor = ObjectAlreadyAdded;


    function Compose(store, obj, allowedRelations, state) {
        this._store = store;
        this._obj = obj;
        this._allowedRelations = allowedRelations || [];
        this._state = state || new State();

    }
    Compose.prototype = {
        constructor: Compose,
        compute: function() {
            var self = this;
            if (this._state.isVisited(this._store, this._obj)) { return; }  // It's circular references. Skip it.
            this._state.visit(this._store, this._obj);
            return when(this._handleOneToMany(), function() {
                return when(self._handleManyToMany(), function() {
                    return self._obj;
                });
            });
        },
        _isRelationAllowed: function(relationName) {
            if (!this._allowedRelations.length) {
                return true;
            }
            for (var i = 0; i < this._allowedRelations.length; i++) {
                if (relationName === this._allowedRelations.split('.')[0]) {
                    return true;
                }
            }
            return false;
        },
        _delegateAllowedRelations: function(relationName) {
            var result = [];
            for (var i = 0; i < this._allowedRelations.length; i++) {
                var allowedRelationNameParts = this._allowedRelations.split('.');
                if (relationName === allowedRelationNameParts[0] && allowedRelationNameParts.length > 1) {
                    result.push(allowedRelationNameParts.slice(1).join('.'));
                }
            }
            return result;
        },
        _handleOneToMany: function() {
            var self = this;
            return whenIter(keys(this._store.relations.oneToMany), function(relationName) {
                if (self._store.relationIsUsedByM2m(relationName)) {
                    return;
                }
                if (!self._isRelationAllowed(relationName)) {
                    return;
                }
                var relation = self._store.relations.oneToMany[relationName];
                var relatedStore = relation.getRelatedStore();
                var relatedQueryResult = relatedStore.find(relation.getRelatedQuery(self._obj));
                return when(relatedQueryResult, function(relatedQueryResult) {
                    self._store.getObjectAccessor().setValue(self._obj, relationName, relatedQueryResult);
                    return whenIter(relatedQueryResult, function(relatedObj) {
                        return self._handleRelatedObj(relatedStore, relatedObj, self._delegateAllowedRelations(relationName));
                    });
                });
            });
        },
        _handleRelatedObj: function(relatedStore, relatedObj, allowedRelations) {
            return relatedStore.compose(relatedObj, allowedRelations, this._state);

        },
        _handleManyToMany: function() {
            var self = this;
            return whenIter(keys(this._store.relations.manyToMany), function(relationName) {
                if (!self._isRelationAllowed(relationName)) {
                    return;
                }
                var m2mRelation = self._store.relations.manyToMany[relationName];
                var relatedStore = m2mRelation.getRelatedStore();
                var relatedQueryResult = relatedStore.find(m2mRelation.getRelatedQuery(self._obj));
                self._store.getObjectAccessor().setValue(self._obj, relationName, relatedQueryResult);
                return when(relatedQueryResult, function(relatedQueryResult) {
                    self._store.getObjectAccessor().setValue(self._obj, relationName, relatedQueryResult);
                    return whenIter(relatedQueryResult, function(relatedObj) {
                        return self._handleRelatedObj(relatedStore, relatedObj, self._delegateAllowedRelations(relationName));
                    });
                });
            });
        }
    };


    function Decompose(store, record, associatedObj) {
        this._store = store;
        this._obj = store.restoreObject(record);
        this._previousState = {};
        this._associatedObj = associatedObj;
        if (!this._associatedObj && this._store.getObjectAccessor().pkExists(this._obj)) {
            this._associatedObj = this._store.get(
                this._store.getObjectAccessor().getPk(this._obj)
            );
        }
    }
    Decompose.prototype = {
        constructor: Decompose,
        compute: function() {
            var self = this,
                localStore = this._store.getLocalStore();
            return when(self._handleForeignKey(), function() {
                return when(self._associatedObj, function(associatedObj) {
                    if (associatedObj) {
                        self._previousState = self._store.getObjectAccessor().getObjectState(associatedObj);
                        var obj = self._store.onConflict(self._obj, associatedObj);
                    } else {
                        var obj = rejectException(localStore.add, localStore, self._obj);
                    }
                    return when(obj, function(obj) {
                        self._obj = obj;
                        return when(self._handleOneToMany(), function() {
                            return when(self._handleManyToMany(), function() {
                                return self._obj;
                            });
                        });
                    });
                });
            });
        },
        _handleForeignKey: function() {
            var self = this;
            return whenIter(keys(this._store.relations.foreignKey), function(relationName) {
                var relation = self._store.relations.foreignKey[relationName];
                var relatedStore = relation.getRelatedStore();
                var relatedObj = self._store.getObjectAccessor().getValue(self._obj, relationName);
                if (relatedObj && typeof relatedObj === "object") {
                    self._setForeignKeyToRelatedObj(relatedObj, relation.getRelatedRelation(), self._obj);
                    return when(self._handleRelatedObj(relatedStore, relatedObj), function(relatedObj) {
                        self._store.getObjectAccessor().setValue(self._obj, relationName, relatedObj);
                    });
                }
            });
        },
        _handleOneToMany: function() {
            var self = this;
            return whenIter(keys(this._store.relations.oneToMany), function(relationName) {
                if (self._store.relationIsUsedByM2m(relationName)) {
                    return;
                }
                var relation = self._store.relations.oneToMany[relationName];
                var relatedStore = relation.getRelatedStore();
                var newRelatedObjectList = self._store.getObjectAccessor().getValue(self._obj, relationName) || [];
                // When we add an aggregate to a single endpoint,
                // the all child of the aggregate in the memory don't have PK,
                // thus, we have to associate child manually based on their order.
                var oldRelatedObjectList = self._previousState[relationName] || [];
                if (!oldRelatedObjectList.length) {
                    oldRelatedObjectList = relatedStore.findList(relation.getRelatedQuery(self._obj));
                }
                // TODO: Set here the reactive result to the object?
                return whenIter(newRelatedObjectList, function(relatedObj, i) {
                    self._setForeignKeyToRelatedObj(self._obj, relation, relatedObj);
                    return when(self._handleRelatedObj(relatedStore, relatedObj, oldRelatedObjectList[i]), function(relatedObj) {
                        newRelatedObjectList[i] = relatedObj;
                    });
                });
            });
        },
        _setForeignKeyToRelatedObj: function(obj, relation, relatedObj) {
            var value = relation.getValue(obj);
            var relatedField = relation.getRelatedField();
            for (var i = 0; i < relatedField.length; i++) {
                if (typeof relatedObj[relatedField[i]] === "undefined") {
                    relatedObj[relatedField[i]] = value[i];
                } else if (relatedObj[relatedField[i]] !== value[i]) {
                    throw Error("Incorrect value of Foreigh Key!");
                }
            }
        },
        _handleRelatedObj: function(relatedStore, relatedObj, associatedRelatedObj) {
            return relatedStore.decompose(relatedObj, associatedRelatedObj);
        },
        _handleManyToMany: function() {
            var self = this;
            return whenIter(keys(this._store.relations.manyToMany), function(relationName) {
                var m2mRelation = self._store.relations.manyToMany[relationName];
                var relatedStore = m2mRelation.getRelatedStore();
                var relatedObjectList = self._store.getObjectAccessor().getValue(self._obj, relationName) || [];
                return whenIter(relatedObjectList, function(relatedObj, i) {
                    return when(self._handleRelatedObj(relatedStore, relatedObj), function(relatedObj) {
                        relatedObjectList[i] = relatedObj;
                        return self._addManyToManyRelation(m2mRelation, relatedObj);
                    });
                });
            });
        },
        _addManyToManyRelation: function(m2mRelation, relatedObj) {
            var relation = this._store.relations.oneToMany[m2mRelation.relation];
            var m2mStore = relation.getRelatedStore();
            var relatedStore = m2mRelation.getRelatedStore();
            var relatedRelation = relatedStore.relations.oneToMany[m2mRelation.relatedRelation];
            var value = relation.getValue(this._obj);
            var relatedValue = relatedRelation.getValue(relatedObj);

            var m2mObject = {};
            var toRelatedField = relatedRelation.getRelatedField();
            for (var i = 0; i < toRelatedField.length; i++) {
                m2mStore.getObjectAccessor().setValue(m2mObject, toRelatedField[i], relatedValue[i]);
            }
            var fromRelatedField = relation.getRelatedField();
            for (var i = 0; i < fromRelatedField.length; i++) {
                m2mStore.getObjectAccessor().setValue(m2mObject, fromRelatedField[i], value[i]);
            }
            var query = clone(relation.getRelatedQuery(this._obj),
                              relatedRelation.getRelatedQuery(relatedObj));
            if (!m2mStore.findList(query).length) {  // Prevent duplicates for bidirectional m2m.
                return m2mStore.getLocalStore().add(m2mObject);
            }
        }
    };


    function State() {
        this._visited = {};
        this._stack = [];
    };
    State.prototype = {
        constructor: State,
        visit: function(store, obj) {
            this._visited[this.getObjectUniqId(store, obj)] = obj;
        },
        isVisited: function(store, obj) {
            return this.getObjectUniqId(store, obj) in this._visited;
        },
        getObjectUniqId: function(store, obj) {
            return [store.getName(), store.getObjectAccessor().getPk(obj)];
        },
        push: function(attr, newValue) {
            var oldValue = this[attr];
            this._stack.push([attr, oldValue]);
            if (typeof newValue === "undefined") {
                newValue = clone(oldValue);
            }
            this[attr] = newValue;
            return oldValue;
        },
        pop: function() {
            var data = this._stack.pop();
            this[data[0]] = data[1];
        }
    };


    function Result(subject, reproducer, filter, objectList, relatedSubjects) {
        this._subject = subject;
        this._reproducer = reproducer;
        this._filter = filter;
        this._initObjectList = Array.prototype.slice.call(objectList);
        this._localReproducers = [];
        this._relatedSubjects = relatedSubjects || [];
        this._disposable = new CompositeDisposable();
        this._setState(objectList);
        observe(this, 'observed', DummyResultObservable);
    }

    Result.wrapProcedure = function(name) {
        return function() {
            var self = this,
                selfArguments = arguments;
            this._localReproducers.push(function(list) {
                list = Array.prototype.slice.call(list);
                Array.prototype[name].apply(list, selfArguments);
                return list;
            });
            var oldObjectList = Array.prototype.slice.call(this);
            var returnValue = Array.prototype[name].apply(this, arguments);
            self._notifyStateChanged(oldObjectList, this);
            return returnValue;
        };
    };
    Result.observedProcedures = ['sort', 'reverse', 'pop', 'push', 'shift', 'unshift'];


    Result.prototype = clone({
        constructor: Result,
        observe: function(enable) {
            if (enable === false) {
                this._disposable.dispose();
                this._disposable = new CompositeDisposable();

            } else if (this.observed().isNull()) {
                for (var i = 0; i < this._relatedSubjects.length; i++) {
                    if (this._relatedSubjects[i].observed().isNull()) {
                        this._relatedSubjects[i].observe(enable);
                    }
                };
                observe(this, 'observed', ResultObservable);
                var self = this;

                this._disposable = this._disposable.add(
                    this._subject.observed().attach(['add'], this._getAddObserver())
                );
                this._disposable = this._disposable.add(
                    this._subject.observed().attach(['update'], this._getUpdateObserver())
                );
                this._disposable = this._disposable.add(
                    this._subject.observed().attach(['delete'], this._getDeleteObserver())
                );

                for (var i = 0; i < self._relatedSubjects.length; i++) {
                    this._disposable = this._disposable.add(
                        self._relatedSubjects[i].observed().attach(
                            ['add', 'update', 'delete'], self._getBroadObserver()
                        )
                    );
                };
            }
            return this;
        },
        _getAddObserver: function() {
            var self = this;
            return function(aspect, obj, index) {
                if (self.indexOf(obj) !== -1) { return; }
                if (self._filter(obj)) {
                    if (typeof index === "undefined") { index = self._initObjectList.length; }
                    self._initObjectList.splice(index, 0, obj);
                    var objectList = Array.prototype.slice.call(self._initObjectList);
                    for (var i = 0; i < self._localReproducers.length; i++) {
                        objectList = self._localReproducers[i](objectList);
                    }
                    self._setState(objectList);
                    self.observed().notify('add', obj, objectList.indexOf(obj));
                }
            };
        },
        _getUpdateObserver: function() {
            var self = this;
            return function(aspect, obj, old) {
                var index = self.indexOf(obj);
                if (index !== -1) {
                    if (self._filter(obj)) {
                        self.observed().notify('update', obj, old);
                    } else {
                        self._initObjectList.splice(self._initObjectList.indexOf(obj), 1);
                        Array.prototype.splice.call(self, index, 1);
                        self.observed().notify('delete', obj, index);
                    }
                } else {
                    if (self._filter(obj)) {
                        self._initObjectList.splice(self._initObjectList.length, 0, obj);
                        var objectList = Array.prototype.slice.call(self._initObjectList);
                        for (var i = 0; i < self._localReproducers.length; i++) {
                            objectList = self._localReproducers[i](objectList);
                        }
                        self._setState(objectList);
                        self.observed().notify('add', obj, self.indexOf(obj));
                    }
                }
            };
        },
        _getDeleteObserver: function() {
            var self = this;
            return function(aspect, obj, index) {
                if (typeof index === "undefined") { index = self.indexOf(obj); }
                assert(index === self.indexOf(obj));
                if (index !== -1) {
                    self._initObjectList.splice(self._initObjectList.indexOf(obj), 1);
                    Array.prototype.splice.call(self, index, 1);
                    self.observed().notify('delete', obj, index);
                }
            };
        },
        _getBroadObserver: function() {
            var self = this;
            return function() {
                var oldObjectList = Array.prototype.slice.call(self);
                self._initObjectList = Array.prototype.slice.call(self._reproducer());
                var newObjectList = Array.prototype.slice.call(self._initObjectList);
                for (var i = 0; i < self._localReproducers.length; i++) {
                    newObjectList = self._localReproducers[i](newObjectList);
                }
                self._setState(newObjectList);
                self._notifyStateChanged(oldObjectList, newObjectList);
            };
        },
        addRelatedSubject: function(relatedSubject) {
            this._relatedSubjects.push(relatedSubject);
            if (!this.observed().isNull()) {
                this._disposable = this._disposable.add(
                    relatedSubject.observed().attach(['add', 'update', 'delete'], this._getBroadObserver())
                );
            }
            return this;
        },
        getRelatedSubjects: function() {
            return this._relatedSubjects.slice();
        },
        reduce: function(callback, initValue) {
            var accumValue;
            var objectList = this.slice();
            if (typeof initValue !== "undefined") {
                accumValue = initValue;
            } else {
                accumValue = objectList.unshift();
            }
            for (var i = 0; i < objectList.length; i++) {
                accumValue = callback(accumValue, objectList[i]);
            }
            return accumValue;
        },
        filter: function() {
            var self = this,
                selfArguments = arguments;
            var child = new SubResult(
                this,
                function() {
                    return Array.prototype.filter.apply(self, selfArguments);
                },
                arguments[0],
                Array.prototype.filter.apply(this, arguments)
            );
            return child;
        },
        slice: function() {
            var self = this,
                selfArguments = arguments;
            var resultType = arguments.length ? PartialResult : SubResult;
            return new resultType(
                this,
                function() {
                    return Array.prototype.slice.apply(self, selfArguments);
                },
                function(obj) { return true; },
                Array.prototype.slice.apply(this, arguments)
            );
        },
        map: function(callback, thisArg) {
            var self = this;
            return new MappedResult(
                this,
                function() {
                    return self.toArray();
                },
                function(obj) { return true; },
                self.toArray(),
                [],
                new _Mapping(callback)
            );
        },
        forEach: function(callback, thisArg) {  // Do not change signature of parent class
            Array.prototype.forEach.apply(this, arguments);
            this._disposable = this._disposable.add(
                this.observed().attach('add', function(aspect, obj) {
                    callback(obj);
                })
            );
        },
        forEachByAttr: function(attr, defaultValue, observer) {
            var attrs = toArray(attr);
            this._disposable = this._disposable.add(
                this.observed().attachByAttr(attrs, defaultValue, observer)
            );
            for (var i = 0; i < this.length; i++) {
                // Don't use Result.prototype.forEach() instead, it'll add observer on load
                var obj = this[i];
                var objObservable = new Observable(obj);
                objObservable.attach(attrs, observer);
                for (var j = 0; j < attrs.length; j++) {
                    var attr = attrs[j];
                    objObservable.notify(attr, defaultValue, obj[attr]);
                }
            }
            return this;
        },
        _setState: function(list) {
            Array.prototype.splice.call(this, 0, Number.MAX_VALUE);
            for (var i = 0; i < list.length; i++) {
                Array.prototype.push.call(this, list[i]);
            }
        },
        _notifyStateChanged: function(oldObjectList, newObjectList) {
            var self = this;
            var deleted = Array.prototype.filter.call(oldObjectList, function(i) { return newObjectList.indexOf(i) === -1; });
            var added = Array.prototype.filter.call(newObjectList, function(i) { return oldObjectList.indexOf(i) === -1; });
            deleted.reverse();  // To preserve indexes fixed on array changing, we begin from tail.
            for (var i = 0; i < deleted.length; i++) {
                self.observed().notify('delete', deleted[i], oldObjectList.indexOf(deleted[i]));
            };
            for (var i = 0; i < added.length; i++) {
                self.observed().notify('add', added[i], newObjectList.indexOf(added[i]));
            };

        },
        toArray: function() {
            return Array.prototype.slice.call(this);
        },
        toJSON: function() {
            return JSON.stringify(this.toArray());
        }
    }, Object.create(Array.prototype));
    for (var i = 0; i < Result.observedProcedures.length; i++) {
        Result.prototype[Result.observedProcedures[i]] = Result.wrapProcedure(Result.observedProcedures[i]);
    }


    function SubResult(subject, reproducer, filter, objectList, relatedSubjects) {
        Result.apply(this, arguments);
        if (!subject.observed().isNull()) {
            this.observe();
        }
    }
    SubResult.prototype = clone({
        constructor: SubResult,
        observe: function(enable) {
            if (enable !== false) {
                this._subject.observe(enable);
            }
            return Result.prototype.observe.call(this, enable);
        }
    }, Object.create(Result.prototype));


    function PartialResult(subject, reproducer, filter, objectList, relatedSubjects) {
        SubResult.apply(this, arguments);
    }
    PartialResult.prototype = clone({
        constructor: PartialResult,
        _getAddObserver: SubResult.prototype._getBroadObserver,
        _getUpdateObserver: function() {
            var self = this;
            return function(aspect, obj, old) {
                SubResult.prototype._getUpdateObserver.call(self).apply(this, arguments);
                if (self.indexOf(obj) !== -1) {
                    self.observed().notify('update', obj, old);
                }
            };
        },
        _getDeleteObserver: SubResult.prototype._getBroadObserver
    }, Object.create(SubResult.prototype));


    function _Mapping(map) {
        this._map = map;
        this._mapping = {};
    }
    _Mapping.prototype = {
        constructor: _Mapping,
        get: function(obj) {
            var key = this._getKey(obj);
            if (!(key in this._mapping)) {
                this._mapping[key] = this._map(obj);
            }
            return this._mapping[key];
        },
        update: function(obj) {
            var key = this._getKey(obj);
            var mappedObj = this._mapping[key];
            clone(this._map(obj), mappedObj);
        },
        del: function(obj) {
            var key = this._getKey(obj);
            delete this._mapping[key];
        },
        _getKey: function(obj) {
            if (obj && typeof obj === "object") {
                return getId(obj);
            }
            return obj;
        }
    };


    function MappedResult(subject, reproducer, filter, objectList, relatedSubjects, mapping) {
        var self = this;
        this._mapping = mapping;
        var mappedReproducer = function() {
            return Array.prototype.map.call(reproducer(), function(obj) { return self._mapping.get(obj); });
        };
        var mappedObjectList = Array.prototype.map.call(objectList, function(obj) { return self._mapping.get(obj); });
        SubResult.call(this, subject, mappedReproducer, filter, mappedObjectList, relatedSubjects);
    }
    MappedResult.prototype = clone({
        constructor: MappedResult,
        _getAddObserver: function() {
            var self = this;
            return function(aspect, obj, index) {
                var mappedObj = self._mapping.get(obj);
                SubResult.prototype._getAddObserver.call(self).call(this, aspect, mappedObj, index);
            };
        },
        _getUpdateObserver: function() {
            var self = this;
            return function(aspect, obj, old) {
                var mappedObj = self._mapping.get(obj);
                var mappedOld = clone(mappedObj);
                self._mapping.update(obj);
                SubResult.prototype._getUpdateObserver.call(self).call(this, aspect, mappedObj, mappedOld);
            };
        },
        _getDeleteObserver: function() {
            var self = this;
            return function(aspect, obj, index) {
                var mappedObj = self._mapping.get(obj);
                self._mapping.del(obj);
                SubResult.prototype._getDeleteObserver.call(self).call(this, aspect, mappedObj, index);
            };
        }
    }, Object.create(SubResult.prototype));


    function AbstractLeafStore(options) {
        AbstractStore.call(this);
        options || (options = {});
        this._mapper = options.mapper ? options.mapper : new Mapper({
            model: options.model,
            aspects: options.aspects,
            objectAccessor: options.objectAccessor,
            pk: options.pk
        });
        this._objectStateMapping = {};
    }
    AbstractLeafStore.prototype = clone({
        constructor: AbstractLeafStore,
        _queryEngine: undefined,
        setNextPk: function(obj) {},
        getQueryEngine: function() {
            return this._queryEngine;
        },
        restoreObject: function(record) {
            var obj = this._mapper.isLoaded(record) ? record : this._mapper.load(record);
            this._setInitObjectState(obj);
            return obj;
        },
        getInitObjectState: function(obj) {
            var oid = this._getObjectId(obj);
            return this._objectStateMapping[oid];
        },
        _setInitObjectState: function(obj) {
            this._objectStateMapping[this._getObjectId(obj)] = this.getObjectAccessor().getObjectState(obj);
        },
        _delInitObjectState: function(obj) {
            delete this._objectStateMapping[this._getObjectId(obj)];
        },
        _getObjectId: function(obj) {
            // The idea from PostgreSQL
            if (!('__oid' in obj)) {
                obj.__oid = this._getNextObjectId();
            }
            return obj.__oid;
        },
        _getNextObjectId: function() {
            AbstractLeafStore._oidCounter || (AbstractLeafStore._oidCounter = 0);
            return ++AbstractLeafStore._oidCounter;
        },
        getObjectAccessor: function() {
            return this._mapper.getObjectAccessor();
        },
        syncDependencies: function(obj, old) {
        },
        getRequiredIndexes: function() {
            var indexes = AbstractStore.prototype.getRequiredIndexes.call(this);
            return indexes.concat(this.getObjectAccessor().pk).filter(arrayUniqueFilter);
        },
        getLocalStore: function() {
            return this;
        },
        getRemoteStore: function() {
            return this;
        },
        _prepareQuery: function(queryEngine, query) {
            return new PrepareQuery(queryEngine, query).compute();
        },
        _makeResult: function(reproducer, filter, objectList, subjects) {
            return new Result(this, reproducer, filter, objectList, subjects);
        },
        get: function(pkOrQuery) {
            if ((typeof pkOrQuery !== "object") || (pkOrQuery instanceof Array)) {
                return this._get(pkOrQuery);
            }
            return this.findList(pkOrQuery)[0];
        },
        _get: function(pk) {
            throw Error("Not Implemented Error");
        },
        find: function(query, options) {
            var self = this;
            typeof query === "undefined" && (query = {});
            return when(this._prepareQuery(this._queryEngine, query), function(query) {
                return when(self._find(query, options), function(objectList) {
                    return self._makeResult(
                        function() {
                            return self.find(query);
                        },
                        function(obj) {
                            return simpleQueryEngine.execute(query, self.getObjectAccessor(), obj);
                        },
                        objectList,
                        query['$subjects']
                    );
                });
            });
        },
        findList: function(query, options) {
            var self = this;
            typeof query === "undefined" && (query = {});
            return when(this._prepareQuery(this._queryEngine, query), function(query) {
                return self._find(query, options);
            });
        },
        _find: function(query, options) {
            return Promise.resolve([]);
        },
        add: function(obj, state) {
            if (!this.getObjectAccessor().pkExists(obj)) {
                this.setNextPk(obj);
            }
            this._setInitObjectState(obj);
            return Promise.resolve(obj);
        },
        update: function(obj, state) {
            var old = this.getInitObjectState(obj);
            this._setInitObjectState(obj);
            return Promise.resolve(obj);
        },
        delete: function(obj, state) {
            this._delInitObjectState(obj);
            return Promise.resolve(obj);
        },
        decompose: function(record, associatedObj) {
            var self = this;
            var obj = this.restoreObject(record);
            if (!associatedObj && this.getObjectAccessor().pkExists(obj)) {
                associatedObj = this.get(
                    this.getObjectAccessor().getPk(obj)
                );
            }
            return when(associatedObj, function(associatedObj) {
                if (associatedObj) {
                    return self.onConflict(obj, associatedObj);
                }
                return this.add(obj);
            });
        },
        onConflict: function(newObj, oldObj) {
            var self = this;
            clone(newObj, oldObj, function(obj, attr, value) {
                return self.getObjectAccessor().setValue(obj, attr, value);
            });
            return self.update(oldObj);
        },
        clean: function() {
            clean(this._objectStateMapping);
        }
    }, Object.create(AbstractStore.prototype));


    function MemoryStore(options) {
        var self = this;
        options || (options = {});
        AbstractLeafStore.call(this, options);
        this.objectList = [];
        this.pkIndex = {};
        this.indexes = {};
        var indexes = options.indexes || [];
        indexes = indexes.concat(this.getRequiredIndexes());
        indexes.forEach(function(index) {
            self.addIndex(index);
        });
    }
    MemoryStore.prototype = clone({
        constructor: MemoryStore,
        _queryEngine: simpleQueryEngine,
        addIndex: function(index) {
            if (!(index in this.indexes)) {
                this.indexes[index] = {};
            }
        },
        add: function(obj, state) {
            obj = this.restoreObject(obj);
            if (!this.getObjectAccessor().pkExists(obj)) {
                this.setNextPk(obj);
                if (!this.getObjectAccessor().pkExists(obj)) {
                    throw new PkRequired();
                }
            }
            var pkValue = this.getObjectAccessor().getPk(obj);
            if (pkValue in this.pkIndex) {
                if (this.pkIndex[pkValue] !== obj) {
                    throw new ObjectAlreadyAdded();
                } else {
                    return this.pkIndex[pkValue];
                }
            }
            this.objectList.push(obj);
            this._indexObj(obj);
            this._setInitObjectState(obj);
            return obj;
        },
        update: function(obj, state) {
            var old = this.getInitObjectState(obj);
            this._reindexObj(old, obj);
            this._setInitObjectState(obj);
            return obj;
        },
        delete: function(obj, state) {
            var objectAccessor = this.getObjectAccessor();
            delete this.pkIndex[objectAccessor.getPk(obj)];
            this.objectList.splice(this.objectList.indexOf(obj), 1);
            for (var field in this.indexes) {
                var value = objectAccessor.getValue(obj, field);
                arrayRemove(this.indexes[field][value], obj);
            }
            this._delInitObjectState(obj);
            return obj;
        },
        _get: function(pk) {
            return this.pkIndex[pk];
        },
        _find: function(query, options) {
            var self = this;
            var initObjectList = self._getInitObjectList(query);
            return initObjectList.filter(function(obj) {
                return !query['$query'] || self._queryEngine.execute(query, self.getObjectAccessor(), obj);
            });
        },
        _getInitObjectList: function(query) {
            return new GetInitObjectList(this._queryEngine, query, this).compute();
        },
        clean: function() {
            clean(this.objectList);
            this._resetIndexes();
            AbstractLeafStore.prototype.clean.call(this);
        },
        _resetIndexes: function() {
            clean(this.pkIndex);
            for (var key in this.indexes) {
                clean(this.indexes[key]);
            }
        },
        _reloadIndexes: function() {
            this._resetIndexes();
            for (var i in this.objectList) {
                this._indexObj(this.objectList[i]);
            }
        },
        _indexObj: function(obj) {
            var objectAccessor = this.getObjectAccessor();
            this.pkIndex[objectAccessor.getPk(obj)] = obj;
            for (var field in this.indexes) {
                var value = objectAccessor.getValue(obj, field);
                if (!(value in this.indexes[field])) {
                    this.indexes[field][value] = [];
                };
                assert(this.indexes[field][value].indexOf(obj) === -1);
                this.indexes[field][value].push(obj);
            }
        },
        _reindexObj: function(old, obj) {
            var self = this;
            var objectAccessor = this.getObjectAccessor();
            if (objectAccessor.getPk(old) !== objectAccessor.getPk(obj)) {
                delete this.pkIndex[objectAccessor.getPk(old)];
                this.pkIndex[objectAccessor.getPk(obj)] = obj;
            }
            for (var field in this.indexes) {
                var oldValue = old[field],
                    value = objectAccessor.getValue(obj, field),
                    index = this.indexes[field];
                if (toString(oldValue) !== toString(value)) {
                    if (!(value in index)) {
                        index[value] = [];
                    };
                    assert(index[value].indexOf(obj) === -1);
                    arrayRemove(index[oldValue], obj);
                    index[value].push(obj);
                    index[value].sort(function(a, b) {
                        return self.objectList.indexOf(a) - self.objectList.indexOf(b);
                    });
                }
            }
        }
    }, Object.create(AbstractLeafStore.prototype));


    function RestStore(options) {
        options || (options = {});
        AbstractLeafStore.call(this, options);
        this._url = options.url;
        this._jQuery = options.jQuery || root.jQuery;
        this._requestOptions = options.requestOptions || {};
    }
    RestStore.prototype = clone({
        constructor: RestStore,
        _queryEngine: djangoFilterQueryEngine,
        _get: function(pk) {
            var self = this;
            return new Promise(function(resolve, reject) {
                self._jQuery.ajax(clone(self._requestOptions, {
                    url: self._getUrl(pk),
                    type: 'GET',
                    success: function(obj) {
                        resolve(obj);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        reject();
                    }
                }));
            }).then(function(obj) {
                return self.restoreObject(obj);
            });

        },
        _find: function(query, options) {
            var self = this;
            typeof query === "undefined" && (query = {});
            return new Promise(function(resolve, reject) {
                self._jQuery.ajax(clone(self._requestOptions, {
                    url: self._getUrl(),
                    type: 'GET',
                    data: query,
                    success: function(objectList) {
                        resolve(objectList);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        reject();
                    }
                }));
            }).then(function(objectList) {
                for (var i = 0; i < objectList.length; i++) {
                    objectList[i] = self.restoreObject(objectList[i]);
                }
                return objectList;
            });
        },
        add: function(obj, state) {
            var self = this;
            return new Promise(function(resolve, reject) {
                self._jQuery.ajax(clone(self._requestOptions, {
                    url: self._getUrl(),
                    type: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: self._serialize(self._mapper.unload(obj)),
                    success: function(response) {
                        resolve(response);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        reject();
                    }
                }));
            }).then(function(response) {
                self._mapper.update(response, obj);
                self._setInitObjectState(obj);
                return obj;
            });
        },
        update: function(obj, state) {
            var self = this;
            return new Promise(function(resolve, reject) {
                self._jQuery.ajax(clone(self._requestOptions, {
                    url: self._getUrl(self.getObjectAccessor().getPk(obj)),
                    type: 'PUT',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: self._serialize(self._mapper.unload(obj)),
                    success: function(response) {
                        resolve(response);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        reject();
                    }
                }));
            }).then(function(response) {
                self._mapper.update(response, obj);
                self._setInitObjectState(obj);
                return obj;
            });
        },
        delete: function(obj, state) {
            var self = this;
            return new Promise(function(resolve, reject) {
                self._jQuery.ajax(clone(self._requestOptions, {
                    url: self._getUrl(self.getObjectAccessor().getPk(obj)),
                    type: 'DELETE',
                    success: function(response) {
                        resolve(obj);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        reject();
                    }
                }));
            }).then(function(obj) {
                this._delInitObjectState(obj);
                return obj;
            });
        },
        _getUrl: function(pk) {
            if (typeof pk === "undefined") {
                return this._url;
            }
            pk = toArray(pk);
            return this._url + '/' + pk.join('/');
        },
        _serialize: function(obj) {
            return JSON.stringify(obj);
        }
    }, Object.create(AbstractLeafStore.prototype));


    function DummyStore(options) {
        AbstractLeafStore.call(this, options);
    }
    DummyStore.prototype = clone({
        constructor: DummyStore,
        isNull: function() {
            return true;
        }
    }, Object.create(AbstractLeafStore.prototype));


    function AutoIncrementStore(options) {
        DummyStore.call(this, options);
        this._counter = 0;
    }
    AutoIncrementStore.prototype = clone({
        constructor: AutoIncrementStore,
        setNextPk: function(obj) {
            this.getObjectAccessor().setPk(obj, ++this._counter);
        }
    }, Object.create(DummyStore.prototype));


    function DefaultModel(attrs) { clone(attrs, this); }


    function RelationalAccessorModelAspectFactory(getterNameFactory) {
        var factory = this;
        this._getterNameFactory = getterNameFactory || function(relationName) {
            return ('get' + relationName.charAt(0).toUpperCase() +
                    relationName.slice(1).replace(/[_-]([a-z])/g, function (g) {
                        return g[1].toUpperCase();
                    }));
        };
        this._aspect = {
            init: function(storeAccessor) {
                factory.initAspect(this, storeAccessor());
            }
        };
    }
    RelationalAccessorModelAspectFactory.prototype = {
        constructor: RelationalAccessorModelAspectFactory,
        compute: function() {
            return this._aspect;
        },
        initAspect: function(aspect, store) {
            this._handleForeignKey(aspect, store);
            this._handleOneToMany(aspect, store);
            this._handleManyToMany(aspect, store);
        },
        _handleForeignKey: function(aspect, store) {
            var self = this;
            keys(store.relations.foreignKey).forEach(function(relationName) {
                var relation = store.relations.foreignKey[relationName];
                aspect[self._getterNameFactory(relationName)] = self._makeObjectGetter(relation);
            });
        },
        _handleOneToMany: function(aspect, store) {
            var self = this;
            keys(store.relations.oneToMany).forEach(function(relationName) {
                var relation = store.relations.oneToMany[relationName];
                aspect[self._getterNameFactory(relationName)] = self._makeCollectionGetter(relation);
            });
        },
        _handleManyToMany: function(aspect, store) {
            var self = this;
            keys(store.relations.manyToMany).forEach(function(relationName) {
                var relation = store.relations.oneToMany[relationName];
                aspect[self._getterNameFactory(relationName)] = self._makeCollectionGetter(relation);
            });
        },
        _makeCollectionGetter: function(relation) {
            return function(query) {
                var obj = this;
                var relatedStore = relation.getRelatedStore();
                var finalQuery = relation.getRelatedQuery(obj);
                clone(query, finalQuery);
                return relatedStore.find(finalQuery);
            };
        },
        _makeObjectGetter: function(relation) {
            return function() {
                var obj = this;
                var relatedStore = relation.getRelatedStore();
                var finalQuery = relation.getRelatedQuery(obj);
                return relatedStore.get(finalQuery);
            };
        }
    };


    function Mapper(options) {
        options = options || {};
        this._model = options.model || DefaultModel;
        this._aspects = options.aspects || [];
        this._mapping = options.mapping || {};
        this._objectAccessor = options.objectAccessor || new ObjectAccessor(options.pk);
        this._reverseMapping = this.makeReverseMapping(this._mapping);
    }
    Mapper.prototype = {
        constructor: Mapper,
        makeReverseMapping: function(mapping) {
            var reverseMapping = {};
            for (var key in mapping) {
                if (mapping.hasOwnProperty(key)) {
                    reverseMapping[mapping[key]] = key;
                }
            }
            return reverseMapping;
        },
        load: function(record) {
            var data = {};
            for (var key in record) {
                if (record.hasOwnProperty(key)) {
                    data[this._reverseMapping[key] || key] = record[key];
                }
            }
            var obj = Object.create(this._model.prototype);
            for (var i = this._aspects.length - 1; i >= 0; i--) {
                var aspect = toArray(this._aspects[i]);
                obj = withAspect.apply(undefined, [aspect[0], obj].concat(aspect.slice(1)));
            }
            this._model.call(obj, data);
            obj.init && obj.init();
            return obj;
        },
        update: function(record, obj) {
            for (var key in record) {
                if (record.hasOwnProperty(key)) {
                    this.getObjectAccessor().setValue(obj, (this._reverseMapping[key] || key), record[key]);
                }
            }
        },
        unload: function(obj) {
            var record = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    record[this._mapping[key] || key] = this.getObjectAccessor().getValue(obj, key);
                }
            }
            return record;
        },
        isLoaded: function(recordOrObj) {
            return recordOrObj instanceof this._model;
        },
        getObjectAccessor: function() {
            return this._objectAccessor;
        }
    };


    function Registry(parent) {
        observe(this, 'observed');
        this._stores = {};
        this._localStores = {};
        this._parents = [];
        this._children = [];
        this.transaction = new TransactionManager(this);
        if (parent) {
            Array.prototype.push.apply(this._parents, parent._parent);
            this._parents.push(parent);
            parent._children.push(this);
        }
    }
    Registry.prototype = {
        constructor: Registry,
        register: function(name, store) {
            this._localStores[name] = store;
            this._updateCache();
            store.register(name, this);
            this.observed().notify('register', store);
        },
        _updateCache: function() {
            for (var i = 0; i < this._parents.length; i++) {
                var parent = this._parents[i];
                clone(parent._localStores, this._stores);
            }
            clone(this._localStores, this._stores);
            for (var i = 0; i < this._children.length; i++) {
                var child = this._children[i];
                child._updateCache();
            }
        },
        has: function(name) {
            return name in this._stores;
        },
        get: function(name) {
            /* if (this._parents.length) {
                return this._stores[name].bind(this);
            } */
            return this._stores[name];
        },
        getStores: function() {
            return clone(this._stores, {});
        },
        keys: function() {
            var r = [];
            for (var name in this._stores) {
                if (!this.isStore(name)) { continue };
                r.push(name);
            }
            return r;
        },
        ready: function() {
            this.observed().notify('ready');
        },
        begin: function() {
            this.transaction.begin();
            this.observed().notify('begin');
        },
        commit: function() {
            var self = this;
            return this.transaction.commit().then(function() {
                self.observed().notify('commit');
            });
        },
        rollback: function() {
            var self = this;
            return this.transaction.rollback().then(function() {
                self.observed().notify('rollback');
            });
        },
        destroy: function() {
            for (var storeName in this._stores) {
                var store = this._stores[storeName];
                this.observed().notify('destroy', store);
                store.destroy();
            }
        },
        clean: function() {
            for (var storeName in this._stores) {
                var store = this._stores[storeName];
                this.observed().notify('clean', store);
                store.clean();
            }
        },
        isStore: function(attr) {
            return this._stores.hasOwnProperty(attr) && (this._stores[attr] instanceof IStore);
        },
        makeChild: function() {
            return new this.constructor(this);
        }
    };


    function TransactionManager(registry) {
        this._transaction = new DummyTransaction(registry);
    }
    TransactionManager.prototype = {
        constructor: TransactionManager,
        begin: function() {
            this._transaction = this._transaction.begin();
        },
        commit: function() {
            var self = this;
            return this._transaction.commit().then(function(transaction) {
                self._transaction = transaction;
            });
        },
        rollback: function() {
            var self = this;
            return this._transaction.rollback().then(function(transaction) {
                self._transaction = transaction;
            });
        },
        add: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            return this._transaction.add(store, obj, onCommit, onRollback, onPending, onAutocommit);
        },
        update: function(store, obj, old, onCommit, onRollback, onPending, onAutocommit) {
            return this._transaction.update(store, obj, old, onCommit, onRollback, onPending, onAutocommit);
        },
        delete: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            return this._transaction.delete(store, obj, onCommit, onRollback, onPending, onAutocommit);
        }
    };


    function AbstractTransaction(registry) {
        this._registry = registry;
    }
    AbstractTransaction.prototype = {
        constructor: AbstractTransaction,
        begin: function() {
            throw Error("Not Implemented Error!");
        },
        commit: function() {
            throw Error("Not Implemented Error!");
        },
        rollback: function() {
            throw Error("Not Implemented Error!");
        },
        add: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            throw Error("Not Implemented Error!");
        },
        update: function(store, obj, old, onCommit, onRollback, onPending, onAutocommit) {
            throw Error("Not Implemented Error!");
        },
        delete: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            throw Error("Not Implemented Error!");
        },
        isNull: function() {
            throw Error("Not Implemented Error");
        }
    };


    /*
     * Implementation of pattern Unit Of Work
     * http://martinfowler.com/eaaCatalog/unitOfWork.html
     */
    function TwoPhaseTransaction(registry, parent) {
        AbstractTransaction.call(this, registry);
        this._parent = parent;
        this._dirtyObjectList = [];
    }
    TwoPhaseTransaction.prototype = clone({
        constructor: TwoPhaseTransaction,
        begin: function() {
            return new TwoPhaseTransaction(this);
        },
        commit: function() {
            var self = this;
            this._topologicalSort();
            return new Iterator(
                this._dirtyObjectList.splice(0, Number.MAX_VALUE)
            ).onEach(function(dirty, resolve, reject) {
                dirty.commit().then(resolve, reject);
            }).iterate().then(function() {
                return self._parent;
            });
        },
        _topologicalSort: function() {
            this._dirtyObjectList.sort(function(left, right) {
                return left.compare(right);
            });
        },
        rollback: function() {
            var self = this;
            return when(whenIter(this._dirtyObjectList.splice(0, Number.MAX_VALUE), function(dirty) {
                return dirty.rollback();
            }), function() {
                return self._parent;
            });
        },
        add: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            var dirty = new AddDirty(store, obj, onCommit, onRollback, onPending, onAutocommit);
            this._dirtyObjectList.push(dirty);
            return dirty.pending();
        },
        update: function(store, obj, old, onCommit, onRollback, onPending, onAutocommit) {
            if (this._findDirty(obj) === -1) {
                var dirty = new UpdateDirty(store, obj, old, onCommit, onRollback, onPending, onAutocommit);
                this._dirtyObjectList.push(dirty);
                return dirty.pending();
            } else {
                return Promise.resolve(obj);
            }
        },
        delete: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            var index = this._findDirty(obj);
            if (index !== -1 && this._dirtyObjectList[index].cancelable()) {
                this._dirtyObjectList.splice(index, 1);
                return Promise.resolve(obj);
            } else {
                var dirty = new DeleteDirty(store, obj, onCommit, onRollback, onPending, onAutocommit);
                this._dirtyObjectList.push(dirty);
                return dirty.pending();
            }
        },
        _findDirty: function(obj) {
            for (var i = 0; i < this._dirtyObjectList.length; i++) {
                if (this._dirtyObjectList[i].hasObj(obj)) {
                    return i;
                }
            }
            return -1;
        },
        isNull: function() {
            return false;
        }
    }, Object.create(AbstractTransaction.prototype));


    function AbstractDirty(store, obj, onCommit, onRollback, onPending, onAutocommit) {
        this.store = store;
        this.obj = obj;
        onCommit && (this.commit = onCommit);
        onRollback && (this.rollback = onRollback);
        this.pending = (onPending || function() { return when(obj); });
        this.autocommit = (onAutocommit || this.commit);
    }
    AbstractDirty.prototype = {
        constructor: AbstractDirty,
        hasObj: function(obj) {
            return this.obj === obj;
        },
        cancelable: function() {
            return false;
        },
        compare: function(other) {
            var weightByOperation = this.getWeight() - other.getWeight();
            if (weightByOperation !== 0) {
                return weightByOperation;
            }
            // handle the root of aggregates in the last
            var weightInAggregate = other.store.getRemoteStore().isNull() - this.store.getRemoteStore().isNull();
            if (weightInAggregate !== 0) {
                return weightInAggregate;
            }
            var weightByDependencies = this._compareByDependencies(other);
            if (weightByDependencies !== 0) {
                return weightByDependencies;
            }
            return this._compareByPk(other);
        },
        getWeight: function() {
            throw Error("Not Implemented Error!");
        },
        commit: function() {
            throw Error("Not Implemented Error!");
        },
        pendind: function() {
            throw Error("Not Implemented Error!");
        },
        autocommit: function() {
            throw Error("Not Implemented Error!");
        },
        rollback: function() {
            throw Error("Not Implemented Error!");
        },
        _compareByDependencies: function(other) {
            if (this.store === other.store) {
                return 0;
            }
            var dependencies = this.store.getDependencies();
            if (dependencies.indexOf(other.store) !== -1) {
                return 1;
            }
            var otherDependencies = this.store.getDependencies();
            if (otherDependencies.indexOf(this.store) !== -1) {
                return -1;
            }
            return 0;
        },
        _compareByPk: function(other) {
            if (this.store !== other.store) {
                return 0;
            }
            var objectAccessor = this.store.getObjectAccessor();
            var pk = toArray(objectAccessor.getPk(this.obj));
            var otherPk = toArray(objectAccessor.getPk(other.obj));
            for (var i = 0; i < pk.length; i++) {
                var weightByExistence = bool(otherPk[i]) - bool(pk[i]);
                if (weightByExistence !== 0) {
                    return weightByExistence;
                }
                // The value can be a string, therefore we can't to use return otherPk[i] - pk[i]
                if (pk[i] === otherPk[i]) {
                    return 0;
                } else if (pk[i] < otherPk[i]) {
                    return -1;
                } else {
                    return 1;
                }
            }
            return 0;
        }
    };


    function AddDirty(store, obj, onCommit, onRollback, onPending, onAutocommit) {
        AbstractDirty.call(this, store, obj, onCommit, onRollback, onPending, onAutocommit);
    }
    AddDirty.prototype = clone({
        constructor: AddDirty,
        cancelable: function() {
            return true;
        },
        getWeight: function() {
            return 0;
        }
    }, Object.create(AbstractDirty.prototype));


    function UpdateDirty(store, obj, old, onCommit, onRollback, onPending, onAutocommit) {
        AbstractDirty.call(this, store, obj, onCommit, onRollback, onPending, onAutocommit);
        this.old = old;
    }
    UpdateDirty.prototype = clone({
        constructor: UpdateDirty,
        getWeight: function() {
            return 1;
        },
        _compareByDependencies: function(other) {
            return 0;
        }
    }, Object.create(AbstractDirty.prototype));


    function DeleteDirty(store, obj, onCommit, onRollback, onPending, onAutocommit) {
        AbstractDirty.call(this, store, obj, onCommit, onRollback, onPending, onAutocommit);
    }
    DeleteDirty.prototype = clone({
        constructor: DeleteDirty,
        getWeight: function() {
            return 2;
        },
        _compareByDependencies: function(other) {
            return -1 * AbstractDirty.prototype._compareByDependencies.call(this, other);
        }
    }, Object.create(AbstractDirty.prototype));


    function DummyTransaction(registry) {
        AbstractTransaction.call(this, registry);
    }
    DummyTransaction.prototype = clone({
        constructor: DummyTransaction,
        begin: function() {
            return new TwoPhaseTransaction(this._registry, this);
        },
        commit: function() {
            return Promise.resolve(this);
        },
        rollback: function() {
            return Promise.resolve(this);
        },
        add: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            return new AddDirty(store, obj, onCommit, onRollback, onPending, onAutocommit).autocommit();
        },
        update: function(store, obj, old, onCommit, onRollback, onPending, onAutocommit) {
            return new UpdateDirty(store, obj, old, onCommit, onRollback, onPending, onAutocommit).autocommit();
        },
        delete: function(store, obj, onCommit, onRollback, onPending, onAutocommit) {
            return new DeleteDirty(store, obj, onCommit, onRollback, onPending, onAutocommit).autocommit();
        },
        isNull: function() {
            return true;
        }
    }, Object.create(AbstractTransaction.prototype));


    /*
     * It's also possible use Mixin into object (for example by argument or by other factory),
     * if there is no conflict inside the single namespace.
     * That's why we use accessor instead of reference.
     * To prevent circular references.
     */
    function observe(subject, accessorName, constructor) {
        var observable = new (constructor || Observable)(subject);
        subject[accessorName || 'observed'] = function() { return observable; };
        return subject;
    }


    function IObservable() {}
    IObservable.prototype = {
        constructor: IObservable,
        set: function(name, newValue) {
            throw Error("Not Implemented Error!");
        },
        get: function(name) {
            throw Error("Not Implemented Error!");
        },
        attach: function(/* aspect, observer | observer */) {
            throw Error("Not Implemented Error!");
        },
        detach: function(/* aspect, observer | observer */) {
            throw Error("Not Implemented Error!");
        },
        notify: function(aspect/*, ...*/) {
            throw Error("Not Implemented Error!");
        },
        isNull: function() {
            throw Error("Not Implemented Error!");
        }
    };


    function Observable(subject) {
        this.getSubject = function() { return subject; };
    };
    Observable.prototype = clone({
        constructor: Observable,
        set: function(name, newValue) {
            var oldValue = this.getSubject()[name];
            if (oldValue === newValue) { return; }
            this.getSubject()[name] = newValue;
            this.notify(name, oldValue, newValue);
        },
        get: function(name) {
            return this.getSubject()[name];
        },
        del: function(name) {
            var oldValue = this.getSubject()[name];
            delete this.getSubject()[name];
            this.notify(name, oldValue);  // arguments.length === 2; We can also pass undefined as 3-d attr, because access to nonexistent attr always returns undefined.
        },
        _getObserver: function(args) {
            return args.length === 1 ? args[0] : args[1];
        },
        _getAspect: function(args) {
            return args.length === 1 ? undefined : args[0];
        },
        attach: function(/* aspect, observer | observer */) {
            var observer = this._getObserver(arguments),
                aspects = toArray(this._getAspect(arguments));
            if (!this._observers) {
                this._observers = {};
            }
            for (var i = 0; i < aspects.length; i++) {
                var aspect = aspects[i];
                if (!this._observers[aspect]) {
                    this._observers[aspect] = [];
                }
                this._observers[aspect].push(observer);
            }
            return new Disposable(this, aspects, observer);
        },
        detach: function(/* aspect, observer | observer */) {
            var observer = this._getObserver(arguments), aspects = toArray(this._getAspect(arguments));
            var observers = this._observers && this._observers[aspect];
            if (!observers) {
                return this;
            }
            for (var i = 0; i < aspects.length; i++) {
                var aspect = aspects[i];
                arrayRemove(observers, observer);
            }
            this._observers[aspect] = observers;
            return this;
        },
        notify: function(aspect/*, ...*/) {
            var observers = this._observers && this._observers[aspect];
            if (!observers) {
                return this;
            }
            var globalObservers = this._observers && this._observers[undefined];
            if (globalObservers) {
                observers = observers.concat(globalObservers);
            }
            var ooArguments = [this.getSubject()].concat(arguments);
            for (var i = 0; i < observers.length; i++) {
                var observer = observers[i];
                if (typeof observer === "function") {
                    observer.apply(this.getSubject(), arguments);
                } else {
                    observer.update.apply(observer, ooArguments);
                }
            }
            return this;
        },
        isNull: function() {
            return false;
        }
    }, Object.create(IObservable.prototype));


    function StoreObservable(store) {
        return Observable.call(this, store);
    }
    StoreObservable.prototype = clone({
        constructor: StoreObservable,
        /*
         * @param {Function} observer function(attr, oldValue, newValue)
         */
        attachByAttr: function(attr, defaultValue, observer) {
            var attrs = toArray(attr);
            var disposables = [];
            disposables.push(
                this.attach('add', function(aspect, obj) {
                    var objObservable = new Observable(obj);
                    objObservable.attach(attrs, observer);
                    for (var i = 0; i < attrs.length; i++) {
                        var attr = attrs[i];
                        objObservable.notify(attr, defaultValue, obj[attr]);
                    }
                })
            );
            disposables.push(
                this.attach('update', function(aspect, obj, old) {
                    var objObservable = new Observable(obj);
                    objObservable.attach(attrs, observer);
                    for (var i = 0; i < attrs.length; i++) {
                        var attr = attrs[i];
                        if (old[attr] !== obj[attr]) {
                            objObservable.notify(attr, old[attr], obj[attr]);
                        }
                    }
                })
            );
            disposables.push(
                this.attach('delete', function(aspect, obj) {
                    var objObservable = new Observable(obj);
                    objObservable.attach(attrs, observer);
                    for (var i = 0; i < attrs.length; i++) {
                        var attr = attrs[i];
                        objObservable.notify(attr, obj[attr], defaultValue);
                    }
                })
            );
            return new CompositeDisposable(disposables);
        }
    }, Object.create(Observable.prototype));


    function ResultObservable(subject) {
        return Observable.call(this, subject);
    }
    ResultObservable.prototype = clone({
        constructor: ResultObservable,
        attachByAttr: StoreObservable.prototype.attachByAttr
    }, Object.create(Observable.prototype));


    function DummyObservable(subject) {
        this.getSubject = function() { return subject; };
    };
    DummyObservable.prototype = clone({
        constructor: DummyObservable,
        set: function(name, newValue) {
            var oldValue = this.getSubject()[name];
            if (oldValue === newValue) { return; }
            this.getSubject()[name] = newValue;
        },
        get: function(name) {
            return this.getSubject()[name];
        },
        attach: function(/* aspect, observer | observer */) {
            return new Disposable(this, undefined, undefined);
        },
        detach: function(/* aspect, observer | observer */) {
            return this;
        },
        notify: function(aspect/*, ...*/) {
            return this;
        },
        isNull: function() {
            return true;
        }
    }, Object.create(IObservable.prototype));


    function DummyStoreObservable(subject) {
        return DummyObservable.call(this, subject);
    }
    DummyStoreObservable.prototype = clone({
        constructor: DummyStoreObservable,
        attachByAttr: function(attrs, defaultValue, observer) {
            return new Disposable(this, attrs, observer);
        }
    }, Object.create(DummyObservable.prototype));


    function DummyResultObservable(subject) {
        return DummyObservable.call(this, subject);
    }
    DummyResultObservable.prototype = clone({
        constructor: DummyResultObservable,
        attachByAttr: DummyStoreObservable.prototype.attachByAttr
    }, Object.create(DummyObservable.prototype));


    function IDisposable() {}
    IDisposable.prototype = {
        constructor: IDisposable,
        dispose: function() {
            throw Error("Not Implemented Error!");
        },
        add: function(other) {
            throw Error("Not Implemented Error!");
        }
    };

    function Disposable(observed, aspect, observer) {
        this._observed = observed;
        this._aspect = aspect;
        this._observer = observer;
    }
    Disposable.prototype = clone({
        constructor: Disposable,
        dispose: function() {
            this._observed.detach(this._aspect, this._observer);
        },
        add: function(other) {
            return new CompositeDisposable([this, other]);
        }
    }, Object.create(IDisposable.prototype));


    function CompositeDisposable(delegates) {
        this._delegates = delegates || [];
    }
    CompositeDisposable.prototype = clone({
        constructor: CompositeDisposable,
        dispose: function() {
            for (var i = 0; i < this._delegates.length; i++) {
                this._delegates[i].dispose();
            }
        },
        add: function(other) {
            return new CompositeDisposable(this._delegates.concat([other]));
        }
    }, Object.create(IDisposable.prototype));


    function Iterator(collection) {
        this._collection = collection;
        this._next = 0;
        this._onEach = function(item, success, error) {};
    }
    Iterator.prototype = {
        constructor: Iterator,
        next: function() {
            return this._collection[this._next++];
        },
        isDone: function() {
            return this._next === this._collection.length;
        },
        onEach: function(callback) {
            this._onEach = callback;
            return this;
        },
        iterate: function() {
            var self = this;
            return new Promise(function(resolve, reject) {
                var success = function() {
                    if (self.isDone()) {
                        resolve();
                        return;
                    }
                    self._onEach(self.next(), success, reject);
                };
                success();
            });
        }
    };


    /*
     * Only o2m
     */
    function cascade(relatedObj, obj, old, relation, state) {
        return relation.getRelatedStore().delete(relatedObj, state);
    }


    /*
     * Only o2m
     */
    function remoteCascade(relatedObj, obj, old, relation, state) {
        return relation.getRelatedStore().delete(relatedObj, state, true);
    }


    /*
     * Only o2m
     */
    function setNull(relatedObj, obj, old, relation, state) {
        if (!(typeof relation.relatedField === "string")) { throw Error("Unable set NULL to composite relation!"); }
        relatedObj[relation.relatedField] = null;  // It's not actual for composite relations.
        return relation.getRelatedStore().update(relatedObj, state);
    }


    /*
     * Only Fk, m2m
     */
    function compose(relatedObj, obj, old, relation, state) {
        if (!relatedObj[relation.relatedName]) {
            relatedObj[relation.relatedName] = [];
        }
        relatedObj[relation.relatedName].push(obj);
        return Promise.resolve(relatedObj);
    }


    /*
     * Only o2m, m2m
     */
    function decompose(relatedObj, obj, old, relation, state) {
        if (relatedObj[relation.relatedName]) {
            arrayRemove(relatedObj[relation.relatedName], obj);
        }
        return Promise.resolve(relatedObj);
    }


    function clone(source, destination, setter) {
        setter = setter || function(obj, attr, value) { obj[attr] = value; };
        if (source === null || typeof source !== "object") { return source; }
        destination = typeof destination !== "undefined" ? destination : new source.constructor();
        for (var i in source) {
            if (source.hasOwnProperty(i)) {
                if (isSpecialAttr(i)) { continue; }
                setter(destination, i, source[i]);
            }
        }
        return destination;
    }


    function deepClone(source, destination, setter) {
        setter = setter || function(obj, attr, value) { obj[attr] = value; };
        if (source === null || typeof source !== "object") { return source; }
        destination = typeof destination !== "undefined" ? destination : new source.constructor();
        if (source instanceof Date) {
            destination.setTime(source.getTime());
            return destination;
        }
        for (var i in source) {
            if (source.hasOwnProperty(i)) {
                if (isSpecialAttr(i)) { continue; }
                setter(destination, i, deepClone(source[i], destination[i]));
            }
        }
        return destination;
    }


    function isSpecialAttr(attr) {
        return ['__id', '__oid'].indexOf(attr) !== -1;
    }


    function keys(obj) {
        var r = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) { continue };
            r.push(i);
        }
        return r;
    }


    function clean(obj) {
        if (obj instanceof Array) {
            Array.prototype.splice.call(obj, 0, Number.MAX_VALUE);
        } else {
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    delete obj[i];
                }
            }
        }
        return obj;
    }


    function toArray(value) {
        if (!(value instanceof Array)) {
            value = [value];
        }
        return value;
    }


    function isPlainObject(obj) {
        return obj && typeof obj === "object" && obj.constructor === Object;
    }


    function isModelInstance(obj) {
        return obj && typeof obj === "object" && '__oid' in obj;  // or getStore in obj
    }


    function rejectException(callback, thisArg) {
        try {
            return callback.apply(thisArg, Array.prototype.slice.call(arguments, 2));
        } catch (e) {
            return Promise.reject(e);
        }
    }


    function resolveRejection(valueOrPromise, errback) {
		var receivedPromise = valueOrPromise && typeof valueOrPromise.then === "function";
		if (!receivedPromise) {
            return valueOrPromise;
        } else {
            return valueOrPromise.catch(function(reason) {
                return Promise.resolve(errback(reason));
            });
        }
    }


    /*
     * Based on https://github.com/dojo/dojo/blob/master/when.js
     */
    function when(valueOrPromise, callback, errback) {
		var receivedPromise = valueOrPromise && typeof valueOrPromise.then === "function";
		if (!receivedPromise) {
			if(arguments.length > 1) {
				return callback ? callback(valueOrPromise) : valueOrPromise;
			} else {
				return Promise.resolve(valueOrPromise);
			}
		}
		if (callback || errback) {
			return valueOrPromise.then(callback, errback);
		}
		return valueOrPromise;
	};


    function whenIter(collection, callback, errback) {
        var next = function(i) {
            return when(callback(collection[i], i), function(item) {
                if (++i < collection.length) {
                    return next(i);
                } else {
                    return collection;
                }
            }, errback);
        };
        return collection.length && next(0);
    }


    function __super__(descendant, instance) {
        return instance['__super_' + getId(descendant) + '__']();
    }


    function withAspect(aspect, delegate) {
        var selfArguments = arguments;
        function Aspect() {}
        Aspect.prototype = delegate;
        Aspect.prototype.constructor = Aspect;
        var wrapped = new Aspect();
        clone(aspect, wrapped);
        wrapped['__super_' + getId(aspect) + '__'] = function() {
            return delegate;
        };
        wrapped.init = function() {
            if (delegate.init) {
                delegate.init.call(this);
            }
            if (aspect.init) {
                aspect.init.apply(this, Array.prototype.slice.call(selfArguments, 2));
            }
            return this;
        };
        return wrapped;
    }


    function withMixins() {
        var currentPrototype = arguments[arguments.length - 1];

        for (var i = arguments.length - 1; i >= 0; i--) {
            var mixinPrototype = arguments[i];
            currentPrototype = withMixin(mixinPrototype, currentPrototype);
        }
        return currentPrototype;
    }


    function withMixin(mixinPrototype, parentPrototype) {
        var newPrototype = Object.create(parentPrototype);
        clone(mixinPrototype, newPrototype);
        newPrototype.constructor = function() {
            mixinPrototype.init.applay(this, arguments);
        };
        newPrototype['__super_' + getId(mixinPrototype) + '__'] = function() {
            return parentPrototype;
        };
        return newPrototype;
    }


    function getId(obj) {
        getId._counter || (getId._counter = 0);
        if (!obj.__id) {
            obj.__id = ++getId._counter;
        }
        return obj.__id;
    }


    function arrayRemove(array, value, cast) {
        for(var i = array.length - 1; i >= 0; i--) {
            if(array[i] === value || cast && cast(array[i]) === cast(value)) {
                array.splice(i, 1);
            }
        }
        return array;
    }


    function arrayEqual(arr1, arr2) {
        if(arr1.length !== arr2.length) { return false; }
        for(var i = arr1.length; i--;) {
            if(arr1[i] !== arr2[i]) { return false; }
        }
        return true;
    }


    function arrayUniqueFilter(value, index, self) {
        return self.indexOf(value) === index;
    }


    function toString(el) { return el && el.toString ? el.toString() : el + ''; }


    function assert(condition, failMessage) {
        if (!condition) throw new Error(failMessage || "Assertion failed.");
    }


    return {
        Store: Store,
        AbstractQueryEngine: AbstractQueryEngine,
        SimpleQueryEngine: SimpleQueryEngine,
        simpleQueryEngine: simpleQueryEngine,
        DjangoFilterQueryEngine: DjangoFilterQueryEngine,
        djangoFilterQueryEngine: djangoFilterQueryEngine,
        PkRequired: PkRequired,
        ObjectAlreadyAdded: ObjectAlreadyAdded,
        Registry: Registry,
        AbstractLeafStore: AbstractLeafStore,
        MemoryStore: MemoryStore,
        DummyStore: DummyStore,
        AutoIncrementStore: AutoIncrementStore,
        RestStore: RestStore,
        CircularReferencesStoreAspect: CircularReferencesStoreAspect,
        ObservableStoreAspect: ObservableStoreAspect,
        PreObservableStoreAspect: PreObservableStoreAspect,
        RelationalStoreAspect: RelationalStoreAspect,
        CheckReferentialIntegrityStoreAspect: CheckReferentialIntegrityStoreAspect,
        __super__: __super__,
        withAspect: withAspect,
        withMixins: withMixins,
        withMixin: withMixin,
        DefaultModel: DefaultModel,
        RelationalAccessorModelAspectFactory: RelationalAccessorModelAspectFactory,
        Mapper: Mapper,
        Observable: Observable,
        observe: observe,
        cascade: cascade,
        remoteCascade: remoteCascade,
        setNull: setNull,
        clone: clone,
        deepClone: deepClone,
        arrayRemove: arrayRemove,
        arrayEqual: arrayEqual,
        keys: keys,
        rejectException: rejectException,
        resolveRejection: resolveRejection,
        when: when,
        whenIter: whenIter
    };
}

if (typeof self === 'object' && self.self === self) {
    var root = self;
} else if (typeof global === 'object' && global.global === global) {
    var root = global;
} else {
    var root = {};
}
if (typeof define === 'function' && define.amd) {
    define(['./polyfill'], function() {
        return namespace(root);
    });
} else if (typeof exports !== 'undefined' && !exports.nodeType) {
    if (typeof module !== 'undefined' && !module.nodeType && module.exports) {
        module.require('./polyfill');
        module.exports = namespace(root);
    }
} else {
    root.store = namespace(root);
}
}());