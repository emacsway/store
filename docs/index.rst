.. Store.js documentation master file, created by
   sphinx-quickstart on Fri Jan 13 21:42:04 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.


Welcome to Store.js' documentation!
===================================

Store.js is a super lightweight implementation of Repository_ pattern for relational data and aggregates.
The library allows you to use Domain-Driven Design (DDD) on client-side as well as reactive programming.

This is similar to Object-Relational Mapping (ORM) for JavaScript, including the Data Mapper pattern (the data can be mapped between objects and a persistent data storage).


Canonical repo
--------------

* Home Page and Source Code: https://github.com/joor/store-js-external
* Docs: TODO


Edge (unstable) repo
--------------------

* Home Page and Source Code: https://github.com/emacsway/store
* Docs: https://edge-storejs.readthedocs.io/

Articles
--------

* Article (in English) "`Implementation of the pattern Repository for browser's JavaScript <https://emacsway.github.io/en/javascript-and-repository-pattern/>`_"
* Article (in Russian): "`Реализация паттерна Repository в браузерном JavaScript <https://emacsway.github.io/ru/javascript-and-repository-pattern/>`_"


.. toctree::
   :maxdepth: 2
   :caption: Contents:


.. contents:: Contents


The :class:`IStore` class is a super lightweight implementation of Repository_ pattern for relational data and composed nested aggregates.
The main goal of Repository_ pattern is to hide the data source.

The :class:`IStore` class has simple interface, so, this abstract layer allows you easy to change the policy of data access.
For example, you can use as data source:

- `REST API <http://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm>`_
- `CORS <https://en.wikipedia.org/wiki/Cross-origin_resource_sharing>`_ REST API
- JSON-RPC
- `html <https://dojotoolkit.org/reference-guide/1.10/dojox/data/HtmlStore.html>`__
- `Indexed Database API <https://www.w3.org/TR/IndexedDB/>`_
- etc.

An essential attribute of Repository pattern is the pattern `Query Object`_, which is necessary to hide the data source.
This class was developed rapidly, in limited time, thus there is used the simplest query syntax similar to `MongoDB Query`_.


Features
========

- Store is easy to debug, since its code is written with a `KISS principle`_, and thus is easy to understand.
- Store handles composed primary keys and composite relations with ease (no need for surrogate keys).
- Store supports cascade deleting and updating with changeable cascade behavior.
- Store uses event system extensively.
- Store has reactive result which synchronizes his state when the observed subject (store or parent result collection) is changed.
- Store has easy query syntax similar to `MongoDB Query`_.
- Store allows you to keep models FULLY clean without any service logic, - only business rules.\
  This is an important point when you use `DDD`_, thus your product team (or customer) will be able to read the business rules from code.
- Store allows you to work with stream of composed aggregates easily, regardless of the depth of nesting of aggregates.\
  See method :func:`Store.prototype.decompose`.
- Store allows you to compose composed aggregates from stores using information about relations.\
  See method :func:`Store.prototype.compose`.
- Store has implemented pattern `Identity Map`_, thus you can easily to work with model instances `by reference <Change Value to Reference_>`__.\
  You always will have the single instance of entity in a memory.
- Store does not have any external dependencies except RequireJS.
- Written in ES3 and should be fully compatible with ES3 (not really tested).


Implemented Patterns
====================

- `Repository`_
- `Query Object`_
- `Identity Map`_
- `Data Mapper`_
- `Gateway`_
- `Unit Of Work`_

- `Observer`_
- `Mediator`_
- `Adapter`_


Used programming paradigms
==========================

- `Reactive Programming`_
- `Event-driven programming`_
- `Aspect-oriented programming`_ (Cross-Cutting Concerns)
- `Declarative programming`_


Store
=====


Store public API
----------------


.. class:: Store([options])

   :param Object options: the keyword arguments.

   The ``options`` object can have the next keys:

   :param options.pk: the name of Primary Key or list of names of composite Primary Key.\
       Optional. The default value is 'id'.
   :type options.pk: string or Array[string]
   :param ObjectAccessor objectAccessor: an instance of :class:`ObjectAccessor`.
       Optional. By default will be created on fly using ``options.pk``.
   :param Array[string] options.indexes: the array of field names to be indexed for fast finding or instance of local store.\
       Note, all field used by relations or primary key will be indexed automatically.\
       Optional.
   :type IStore localStore: an instance of :class:`IStore`. Optional.\
       By default will be created on fly using ``options``
   :param IStore remoteStore: an instance of :class:`IStore`. Optional.\
       By default will be created on fly using ``options``
   :param function model: the model constructor, which should be applied before to add object into the store.\
       Can be usefull in combination with :func:`Store.prototype.decompose`.\
       Optional. The default value is :class:`DefaultModel`
   :param Mapper mapper: an instance of :class:`Mapper`. Optional.\
       Optioans. By default will be created on fly using ``options.model``
   :param Object relations: the dictionary describes the schema relations.

   The format of ``options.relations`` argument::

      {
          foreignKey: {
              firstForeignKeyName: {
                  [field: fieldNameOfCurrentStore,] // (string | Array[string]),
                      // optional for Fk, in this case the relation name will be used as field name
                  relatedStore: nameOfRelatedStore, // (string)
                  relatedField: fieldNameOfRelatedStore, // (string | Array[string])
                  [onAdd: callableOnObjectAdd,] // (function) compose
                  [onDelete: callableOnObjectDelete,] // (function) cascade|setNull
                  [onUpdate: callableOnObjectUpdate,] // (function)
              },
              secondForeignKeyName: ...,
              ...
          },
          [oneToMany: {
              firstOneToManyName: {
                  field: fieldNameOfCurrentStore, // (string | Array[string]),
                  relatedStore: nameOfRelatedStore, // (string)
                  relatedField: fieldNameOfRelatedStore, // (string | Array[string])
                  [relatedName: nameOfReverseRelationOfRelatedStore,]
                  [onAdd: callableOnObjectAdd,] // (function)
                  [onDelete: callableOnObjectDelete,] // (function) cascade|setNull|decompose
                  [onUpdate: callableOnObjectUpdate,] // (function)
              },
              secondOneToManyName: ...,
              ...
          },]
          manyToMany: {
              fistManyToManyName: {
                  relation: relationNameOfCurrentStore, // (string)
                      // the name of foreignKey relation to middle M2M store.
                  relatedStore: nameOfRelatedStore, // (string)
                  relatedRelation: relationNameOfRelatedStore, // (string)
                      // the name of oneToMany relation from related store to middle M2M store.
                  [onAdd: callableOnObjectAdd,] // (function) compose
                  [onDelete: callableOnObjectDelete,] // (function) cascade|setNull|decompose
                  [onUpdate: callableOnObjectUpdate,] // (function)
              },
              secondManyToManyName: ...,
              ...
          }
      }

   If oneToMany is not defined, it will be built automatically from foreignKey of related store.
   In case the foreignKey don't has relatedName key, a new relatedName will be generated from the store name and "Set" suffix.

   | If ``options.objectAccessor`` is provided, the ``options.pk`` will be ignored.
   | If ``options.mapper`` is provided, the ``options.model`` and ``options.objectAccessor`` will be ignored.
   | If ``options.localStorage`` is provided, the ``options.indexes`` will be ignored.

   The public method of Store:

   .. function:: Store.prototype.pull(query, options)

      Populates local store from remote store.

      :param Object query: the Query Object.
      :param Object options: options to be passed to the remote store.
      :rtype: Promise<Array[Object], Error>

   .. function:: Store.prototype.get(pkOrQuery)

      Retrieves a Model instance by primary key or by Query Object.

      :param pkOrQuery: the primary key of required Model instance or Query Object.
      :type pkOrQuery: number or string or Array or Object

   .. function:: Store.prototype.add(obj)

      Adds a Model instance into the Store instance.

      :param Object obj: the Model instance to be added.
      :rtype: Promise<Object, Error>

   .. function:: Store.prototype.update(obj)

      Updates a Model instance in the Store instance.

      :param Object obj: the Model instance to be updated.
      :rtype: Promise<Object, Error>

   .. function:: Store.prototype.save(obj)

      Saves a Model instance into the Store instance.
      Internally the function call will be delegated to :func:`Store.prototype.update`
      if obj has primary key, else to :func:`Store.prototype.add`

      :param Object obj: the Model instance to be saved.
      :rtype: Promise<Object, Error>

   .. function:: Store.prototype.delete(obj)

      Deletes a Model instance from the Store instance.

      :param Object obj: the Model instance to be deleted.
      :rtype: Promise<Object, Error>

   .. function:: Store.prototype.find(query)

      Returns a :class:`Result` instance with collection of Model instances meeting the selection criteria.

      :param Object query: the Query Object.

   .. function:: Store.prototype.compose(obj)

      Builds a nested hierarchical composition of related objects with the ``obj`` top object.
      Example: `Compose`_.

      :param Object obj: the Model instance to be the top of built nested hierarchical composition

   .. function:: Store.prototype.decompose(obj)

      Populates related stores from the nested hierarchical composition of related objects.
      Example: `Decompose`_.

      :param Object obj: the nested hierarchical composition of related objects with the ``obj`` top object

   .. function:: Store.prototype.observed()

      Returns the :class:`StoreObservable` interface of the store.

      :rtype: StoreObservable


   The service public methods (usually you don't call these methods):

   .. function:: Store.prototype.register(name, registry)

   .. function:: Store.prototype.destroy()

   .. function:: Store.prototype.clean()


Store events
------------


Events by ObservableStoreAspect
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

=================  =============================================
Event              When notified
=================  =============================================
"add"              on object is added to store, triggered by :func:`Store.prototype.add`

"update"           on object is updated in store, triggered by :func:`Store.prototype.update`

"delete"           on object is deleted from store, triggered by :func:`Store.prototype.delete`

"restoreObject"    on object is restored, triggered by :func:`Store.prototype.delete`

"destroy"          immediately before store is destroyed, triggered by :func:`Store.prototype.destroy`
                   Usually used to kill
                   `reference cycles <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management>`__.
=================  =============================================


Store events by PreObservableStoreAspect
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

============  =============================================
Event         When notified
============  =============================================
"preAdd"      before object is added to store, triggered by :func:`Store.prototype.add`

"preUpdate"   before object is updated in store, triggered by :func:`Store.prototype.update`

"preDelete"   before object is deleted from store, triggered by :func:`Store.prototype.delete`
============  =============================================


Store observers
---------------


Store functional-style observer signature:

.. function:: storeObserver(aspect, obj)

   ``this`` variable inside observer is setted to the notifier :class:`IStore` instance.

   :param string aspect: the event name
   :param Object obj: the Model instance.


Store OOP-style Observer interface:

.. class:: IStoreObserver()

   .. function:: update(subject, aspect, obj)

      :param Store subject: the notifier
      :param string aspect: the event name
      :param Object obj: the Model instance.

An observer of the events "update" has one extra argument "oldObjectState".


Result
======


Result public API
-------------------


.. class:: Result(subject, reproducer, objectList[, relatedSubjects])

   The Result is a subclass of Array (yes, a composition would be better than the inheritance, but it was written by ES3).

   :param Store subject: the subject of result
   :param function reproducer: the reproducer of actual state of result
   :param Array[Object] objectList: the list of model instances
   :param Array[Store] relatedSubjects: the list of subjects which can affect the result

   .. function:: Result.prototype.observe(enabled)

      Makes observable the result, and attaches it to it's subject.

      :param enabled: if enabled is false, the all observers of the result will be detached form its subject.
      :type enabled: Boolean or undefined
      :rtype: Result

   .. function:: Result.prototype.observed()

      Returns the :class:`ResultObservable` interface of the result.

      :rtype: ResultObservable

   .. function:: Result.prototype.addRelatedSubject(relatedSubject)

      Adds subject on which result should be dependent.

      :param relatedSubject: the subject on which result should be dependent
      :type relatedSubject: Array[Store or Result or SubResult]

      :rtype: Result


Result events
-------------

============  =============================================
Event         When notified
============  =============================================
"add"         on object is added to result

"update"      on object is updated in result

"delete"      on object is deleted from result
============  =============================================

An observer of the event "update" has one extra argument "oldObjectState".


.. class:: SubResult(subject, reproducer, objectList[, relatedSubjects])

   The SubResult is a subclass of :class:`Result`.
   The difference is only the subject can be Result or another SubResult.

   :param subject: the subject of result
   :type subject: Result or SubResult
   :param function reproducer: the reproducer of actual state of result
   :param Array[Object] objectList: the list of model instances
   :param relatedSubjects: the list of subjects which can affect the result
   :type relatedSubjects: Array[Result or SubResult]


Registry
========


Registry public API
-------------------


.. class:: Registry()

   The Registry class is a Mediator_ between :class:`stores <Store>` and has goal to lower the Coupling_.
   The public methods of Registry:

   .. function:: register(name, store)

      Links the :class:`IStore` instance and the :class:`Registry` instance.

      :param string name: the name of :class:`IStore` instance to be registered. \
         This name will be used in relations to the store from related stores.
      :param Store store: the instance of :class:`IStore`

   .. function:: Registry.prototype.has(name)

      Returns true if this store name is registered, else returns false.

      :param string name: the name of :class:`IStore` instance the presence of which should be checked.
      :rtype: Boolean

   .. function:: Registry.prototype.get(name)

      Returns :class:`IStore` instance by name.

      :param string name: the name of :class:`IStore` instance the presence of which should be checked.
      :rtype: Store

   .. function:: Registry.prototype.getStores()

      Returns mapping of name and :class:`IStore` instances

   .. function:: Registry.prototype.keys()

      Returns list of names.

      :rtype: Array[String]

   .. function:: Registry.prototype.ready()

      Notifies the attached observers that all stores are registered.
      Usualy used to attach observers of registered :class:`stores <Store>` one another.

   .. function:: Registry.prototype.begin()

      Delays save objects by remote storage
      until :func:`Registry.prototype.commit` will be called.

   .. function:: Registry.prototype.commit()

      Runs delayed saving for all objects which has been added, updated, deleted
      since :func:`Registry.prototype.begin` has been called.

   .. function:: Registry.prototype.rollback()

      Discards all uncommited changes
      since :func:`Registry.prototype.begin` has been called.

   .. function:: Registry.prototype.destroy()

      Notifies the attached observers when the data will be destroyed.
      The method calls :func:`Store.prototype.destroy` method for each registered store.

   .. function:: Registry.prototype.clean()

      Cleans all registered :class:`stores <Store>`.

   .. function:: Registry.prototype.observed()

      Returns the :class:`Observable` interface of the registry.

      :rtype: Observable


Registry events
---------------

================  =============================================
Event             When notified
================  =============================================
"register"        on store registered

"ready"           on all stores are registered

"begin"           on begin of transaction

"commit"          on commit of transaction

"rollback"        on rollback of transaction

"destroy"         on all data will be destroyed
================  =============================================


Registry observers
------------------


Registry functional-style observer signature:

.. function:: registryObserver(aspect, store)

   ``this`` variable inside observer is setted to the notifier :class:`Registry` instance.

   :param string aspect: the event name
   :param Store store: the :class:`IStore` instance. This argument is omitted for "ready" event.


Registry OOP-style Observer interface:

.. class:: IRegistryObserver()

   .. function:: update(subject, aspect, store)

      :param Registry subject: the notifier
      :param string aspect: the event name
      :param Store store: the :class:`IStore` instance. This argument is omitted for "ready" event.


Observable Interface
====================


.. class:: Observable(obj)

   Creates an observable interface for object.

   :param Object obj: the object to be observable

   .. function:: Observable.prototype.set(name, newValue)

      Sets the new value of attribute of the object by the name of the attribute.

      :param string name: the name of the object attribute to be updated
      :param newValue: the new value of the object attribute

   .. function:: Observable.prototype.get(name)

      Returns the current value of the object attribute by name.

      :param string name: the name of the object attribute

   .. function:: Observable.prototype.attach([aspect, ]observer)

      Attaches the observer to the specified aspect(s)
      If aspect is omitted, the observer will be attached to the global aspect which is notified on every aspect.
      Returns instance of :class:`Disposable`.
      So, you can easily detach the attached observer by calling the :func:`Disposable.prototype.dispose`.

      :param aspect: the aspect name(s).
      :type aspect: string or Array[string]
      :param observer: the observer
      :type observer: function or Object
      :rtype: Disposable

   .. function:: Observable.prototype.detach([aspect, ]observer)

      Detaches the observer to the specified aspect(s).
      If aspect is omitted, the observer will be detached from the global aspect which is notified on every aspect.

      :param aspect: the aspect name(s).
      :type aspect: string or Array[string]
      :param observer: the observer
      :type observer: function or Object

   .. function:: Observable.prototype.notify(aspect[[, argument], ...])

      Notifies observers attached to specified and global aspects.
      All arguments of this function are passed to each observer.

      :param string aspect: the aspect name.

   .. function:: Observable.prototype.isObservable()

      Returns True is class of current instance is not DummyObservable.

      :rtype: Boolean


StoreObservable Interface
=========================

.. class:: StoreObservable(store)

   Creates an observable interface for :class:`IStore` instance.
   Inherited from the :class:`Observable` class.

   :param Store store: the :class:`IStore` instance to be observable.

   .. js:attribute:: StoreObservable.prototype

      An :class:`Observable` instance.

   .. function:: StoreObservable.prototype.attachByAttr(attr, defaultValue, observer)

      Attaches observer to "add", "update", "delete" events of the :class:`store <Store>`.
      The ``observer`` will be notified only if value attribute is changed with the arguments:

      - attribute name
      - old value
      - new value

      :param attr: the aspect name(s).
      :type attr: string or Array[string]
      :param defaultValue: default value (used as attribute value when object is added or deleted)
      :param observer: the observer
      :type observer: function or Object
      :rtype: CompositeDisposable


Result Observable Interface
===========================

.. class:: ResultObservable(subject)

   Creates an observable interface for :class:`Result` instance.
   Inherited from the :class:`Observable` class.

   :param Store store: the :class:`IStore` instance to be observable.

   .. js:attribute:: ResultObservable.prototype

      An :class:`Observable` instance.

   .. function:: ResultObservable.prototype.attachByAttr(attr, defaultValue, observer)

      Attaches observer to "add", "update", "delete" events of the :class:`result <Result>`.
      The ``observer`` will be notified only if value attribute is changed with the arguments:

      - attribute name
      - old value
      - new value

      :param attr: the aspect name(s).
      :type attr: string or Array[string]
      :param defaultValue: default value (used as attribute value when object is added or deleted)
      :param observer: the observer
      :type observer: function or Object
      :rtype: CompositeDisposable


Query Object
============


Comparison operators
--------------------


$eq
^^^

Specifies equality condition. The `$eq`_ operator matches objects where the value of a field equals the specified value.

::

   {<field>: {$eq: <value>}}

The `$eq`_ expression is equivalent to ``{field: <value>}``


$ne
^^^

Specifies not equality condition. The `$ne`_ operator matches objects where the value of a field doesn't equal the specified value.

::

   {<field>: {$ne: <value>}}


$in
^^^

The `$in`_ operator selects the objects where the value of a field equals any value in the specified array.

::

   {field: {$in: [<value1>, <value2>, ... <valueN> ]}}


$callable
^^^^^^^^^

Function arguments: value, obj, field.

::

   {field: {$callable: <function>}}

The short form::

  {field: <function>}

Another way to use `$callable`_ operator:

::

   {$callable: <function>}

In this case the function accepts obj as single argument.


Logical operators
-----------------


$and
^^^^

`$and`_ performs a logical AND operation on an array of two or more expressions (e.g. ``<expression1>``, ``<expression2>``, etc.) and selects the objects that satisfy all the expressions in the array.

::

   {$and: [{<expression1>}, {<expression2>}, ... , {<expressionN>}]}

In short form you can simple list expressions in single object. These two expressions are equivalent:

::

   {$and: [{firstName: 'Donald'}, {lastName: 'Duck'}]}

::

   {firstName: 'Donald', lastName: 'Duck'}



$or
^^^

The `$or`_ operator performs a logical OR operation on an array of two or more ``<expressions>`` and selects the objects that satisfy at least one of the ``<expressions>``.

::

   {$or: [{<expression1>}, {<expression2>}, ... , {<expressionN>}]}


Relational operators
--------------------

All relation operators can be nested, for example, this expression is valid::

  tagStore.find({'posts.author.country.code': 'USA'})


$rel
^^^^

Delegates expression to related store by relation.
The type of relation will be detected automatically.
The relation should be described by one of:

- :attr:`Store.relations.foreignKey`
- :attr:`Store.relations.oneToMany`
- :attr:`Store.relations.manyToMany`

::

   {relation: {$rel: {<expression>}}}

In short form you can use dot in the field (the left part). These two expressions are equivalent:

::

   {author: {$rel: {firstName: 'Donald'}}

::

   {'author.firstName': 'Donald'}


Query Modifiers
---------------


$query
^^^^^^

Selection criteria.

::

    {$query: {title: 'Donald Duck'}}


$orderby
^^^^^^^^

.. warning:: This operator is not implemented yet!

The $orderby operator sorts the results of a query in ascending or descending order.

::

    {$query: {title: 'Donald Duck'}, $orderby: [{age: -1}, {title: 1}]}

This example return all objects sorted by the "age" field in descending order and then by the "title" field in ascending order.
Specify a value to $orderby of negative one (e.g. -1, as above) to sort in descending order or a positive value (e.g. 1) to sort in ascending order.


$limit
^^^^^^

.. warning:: This operator is not implemented yet!

Limit.

::

    {$query: {title: 'Donald Duck'}, $limit: 10}


$offset
^^^^^^^

.. warning:: This operator is not implemented yet!

Offset.

::

    {$query: {title: 'Donald Duck'}, $offset: 10}


Examples
========


Query
-----


.. literalinclude:: ../tests/testQuery.js
   :language: javascript
   :linenos:


Simple relations
----------------


.. literalinclude:: ../tests/testSimpleRelations.js
   :language: javascript
   :linenos:


Composite relations
-------------------


.. literalinclude:: ../tests/testCompositeRelations.js
   :language: javascript
   :linenos:


Many to many relations
----------------------


.. literalinclude:: ../tests/testManyToMany.js
   :language: javascript
   :linenos:


Compose
-------


.. literalinclude:: ../tests/testCompose.js
   :language: javascript
   :linenos:


Decompose
---------


.. literalinclude:: ../tests/testDecompose.js
   :language: javascript
   :linenos:


Observable object
-----------------

Example of fast real-time aggregation:

.. literalinclude:: ../tests/testObservable.js
   :language: javascript
   :linenos:


StoreObservable
---------------

Example of fast real-time aggregation using :

.. literalinclude:: ../tests/testStoreObservable.js
   :language: javascript
   :linenos:


Reaction of Result on changes in Store
--------------------------------------

.. literalinclude:: ../tests/testResult.js
   :language: javascript
   :linenos:


Contributing
============

Please, use `Dojo Style Guide <https://dojotoolkit.org/reference-guide/1.10/developer/styleguide.html>`_ and `Dojo contributing workflow <https://github.com/dojo/meta/blob/master/CONTRIBUTING.md>`_.


.. _Coupling: http://wiki.c2.com/?CouplingAndCohesion
.. _Cohesion: http://wiki.c2.com/?CouplingAndCohesion
.. _DDD: https://en.wikipedia.org/wiki/Domain-driven_design
.. _KISS principle: http://people.apache.org/~fhanik/kiss.html

.. _Adapter: https://en.wikipedia.org/wiki/Adapter_pattern
.. _Mediator: https://en.wikipedia.org/wiki/Mediator_pattern
.. _MongoDB Query: https://docs.mongodb.com/manual/reference/operator/query/
.. _Observer: https://en.wikipedia.org/wiki/Observer_pattern
.. _Reactive Programming: https://en.wikipedia.org/wiki/Reactive_programming
.. _Event-driven programming: https://en.wikipedia.org/wiki/Event-driven_programming
.. _Aspect-oriented programming: https://en.wikipedia.org/wiki/Aspect-oriented_programming
.. _Declarative programming: https://en.wikipedia.org/wiki/Declarative_programming

.. _Gateway: https://martinfowler.com/eaaCatalog/gateway.html
.. _Data Mapper: https://www.martinfowler.com/eaaCatalog/dataMapper.html
.. _Identity Map: https://www.martinfowler.com/eaaCatalog/identityMap.html
.. _Repository: http://martinfowler.com/eaaCatalog/repository.html
.. _Query Object: http://martinfowler.com/eaaCatalog/queryObject.html
.. _Unit Of Work: http://martinfowler.com/eaaCatalog/unitOfWork.html

.. _Change Value to Reference: https://www.refactoring.com/catalog/changeValueToReference.html


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
