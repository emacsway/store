define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        clone = store.clone,
        when = store.when,
        whenIter = store.whenIter,
        withAspect = store.withAspect;


    function testDataAccessingWithCrossCuttingConcerns(resolve, reject) {
        var registry = new store.Registry();


        function Money(amount) {
            this.amount = amount;
        }
        Money.prototype = {
            constructor: Money,
            add: function(other) {
                return new Money(this.amount + other.amount);
            },
            multiply: function(multiplier) {
                return new Money(this.amount * multiplier);
            }
        };


        function Order(attrs) {
            clone(attrs, this);
        }
        Order.prototype = {
            constructor: Order,
            getPriceTotal: function() {
                return when(this.getItems(), function(items) {
                    return items.reduce(function(amount, item) {
                        return amount.add(item.price.multiply(item.quantity));
                    }, new Money(0));
                });
            },
            getItems: function() {
                throw Error("Not Implemented Error");
            }
        };


        // We can create aspect manually
        var OrderRelationsAspect = {
            init: function(storeAccessor) {
                this._getStore = storeAccessor;
            },
            getItems: function() {
                return when(this._getStore().getRegistry().get('item').find({order_id: this.id}), function(items) {
                    return items.toArray();
                });
            }
        };


        // Or we can create aspect automatically using relations declaration from the store
        var OrderRelationsAspect = new store.RelationalAccessorModelAspectFactory().compute();


        var OrderRelationsStubAspect = {
            init: function(items) {
                this._items = items;
            },
            getItems: function() {
                return when(this._items);
            }
        };


        function Item(attrs) {
            clone(attrs, this);
        }


        var orderStore = new store.Store({
            model: Order,
            aspects: [[OrderRelationsAspect, function() { return registry.get('order'); }]]
        });
        registry.register('order', orderStore);

        var itemStore = new store.Store({
            relations: {
                foreignKey: {
                    order: {
                        field: 'order_id',
                        relatedStore: 'order',
                        relatedField: 'id',
                        relatedName: 'items',
                        onDelete: store.cascade
                    }
                }
            }
        });
        registry.register('item', itemStore);

        registry.ready();

        // Testing the model itself
        // The model is not aware about repository.
        var order = new Order({
            id: 1,
            client_id: 10
        });
        // wraps the order with aspect stub
        order = withAspect(OrderRelationsStubAspect, order, [
            {id: 1, price: new Money(100), quantity: 5, order_id: 1, product_id: 101},
            {id: 2, price: new Money(200), quantity: 10, order_id: 1, product_id: 102}
        ]).init();
        assert(order instanceof Order);
        return when(order.getPriceTotal(), function(price) {
            assert(price.amount === 2500);

            // Ok, now testing an order with repository
            var orders = [
                {id: 1, client_id: 10}
            ];
            return when(whenIter(orders, function(order) {
                return orderStore.getLocalStore().add(order);
            }), function () {

                var items = [
                    {id: 1, price: new Money(100), quantity: 5, order_id: 1, product_id: 101},
                    {id: 2, price: new Money(200), quantity: 10, order_id: 1, product_id: 102},
                    {id: 3, price: new Money(300), quantity: 1, order_id: 1, product_id: 103},
                ];
                return when(whenIter(items, function(item) {
                    return itemStore.getLocalStore().add(item);
                }), function() {
                    return when(registry.get('order').get(1), function(order) {
                        assert(order instanceof Order);
                        return when(order.getPriceTotal(), function(price) {
                            assert(price.amount === 2800);
                        });
                    });
                });
            });
        });
    }
    return testDataAccessingWithCrossCuttingConcerns;
});