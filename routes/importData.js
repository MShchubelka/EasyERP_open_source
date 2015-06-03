/**
 * Created by Roman on 27.05.2015.
 */
var async = require('async');
var express = require('express');
var router = express.Router();
var ImportHandler = require('../helpers/importer/importer');
var mongoose = require('mongoose');
var _ = require('lodash');
/*var multipart = require('connect-multiparty');
 var multipartMiddleware = multipart();*/
var tasks = require('../helpers/importer/map/').tmDevelopment;

module.exports = function (models) {
    var handler = ImportHandler({
        msSql: {
            user: 'thinkmobiles@wbje9y2n5u',
            password: '1q2w3e!@#',
            server: 'wbje9y2n5u.database.windows.net',
            database: 'ex_dev',

            options: {
                encrypt: true
            }
        }
    });

    function comparator(columnName, field) {
       var targetObject =  _.find(field, function(fieldValue){
           return fieldValue.value.toLowerCase() === columnName.toString().toLowerCase();
       });
        return targetObject.fieldValue;
    };

    function queryBuilder(table) {
        return 'SELECT * FROM ' + table;
    };

    function salesImporter(req, tasks) {
        var departmentShema = tasks[0];
        var projectShema = tasks[1];
        var employeeShema = tasks[2];
        var customerSchema = tasks[3];
        var ownerId = req.session ? req.session.uId : null;

        function importCustomer(customerSchema, seriesCb) {
            var query = queryBuilder(customerSchema.table);
            var waterfallTasks;

            function getData(callback) {
                handler.importData(query, callback);
            }

            function saverCustomer(fetchedArray, callback) {
                var collection = customerSchema.collection;
                var Schema = mongoose.Schemas[collection];
                var Model = models.get(req.session.lastDb, collection, Schema);
                var model;

                var mongooseFields = Object.keys(customerSchema.aliases);

                var q = async.queue(function (fetchedCustomer, cb) {
                    var objectToSave = {};

                    for (var i = mongooseFields.length - 1; i >= 0; i--) {
                        var key = mongooseFields[i];
                        var msSqlKey = departmentShema.aliases[key];

                        objectToSave[key] = fetchedCustomer[msSqlKey];
                        objectToSave.createdBy = {
                            user: ownerId
                        };
                        objectToSave.editedBy = {
                            user: ownerId
                        }
                    }

                    if (fetchedCustomer) {
                        model = new Model(objectToSave);
                        model.save(cb);
                    }
                }, 100);

                q.drain = function () {
                    callback(null, 'done');
                };

                async.each(fetchedArray, function (fetchedCustomer) {
                    q.push(fetchedCustomer, function () {
                        console.log('finished ' + fetchedCustomer.ID);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, 'Completed');
                })
            }

            waterfallTasks = [getData, saverCustomer];

            async.waterfall(waterfallTasks, function (err, result) {
                if (err) {
                    seriesCb(err);
                }

                seriesCb(null, 'Complete')
            });
        };

        function importProject(projectShema, seriesCb) {
            var query = queryBuilder(projectShema.table);
            var waterfallTasks;

            function getData(callback) {
                handler.importData(query, callback);
            }

            function saverProject(fetchedArray, callback) {
                var collection = projectShema.collection;
                var customerCollection = customerSchema.collection;
                var employeeCollection = employeeShema.collection;
                var Schema = mongoose.Schemas[collection];
                var CustomerSchema = mongoose.Schemas[customerCollection];
                var EmployeeShema = mongoose.Schema[employeeCollection];
                var Model = models.get(req.session.lastDb, collection, Schema);
                var Customer = models.get(req.session.lastDb, customerCollection, CustomerSchema);
                var Employee = models.get(req.session.lastDb, employeeCollection, EmployeeShema);
                var model;

                var mongooseFields = Object.keys(projectShema.aliases);

                var q = async.queue(function (fetchedProject, cb) {
                    var objectToSave = {};
                    var customerQuery;
                    var employeeQuery;

                    for (var i = mongooseFields.length - 1; i >= 0; i--) {
                        var key = mongooseFields[i];
                        var msSqlKey = projectShema.aliases[key];

                        if (msSqlKey in projectShema.comparator) {
                            fetchedProject[msSqlKey] = comparator(fetchedProject[msSqlKey], projectShema.comparator[msSqlKey]);
                        }

                        objectToSave[key] = fetchedProject[msSqlKey];
                        objectToSave.createdBy = {
                            user: ownerId
                        };
                        objectToSave.editedBy = {
                            user: ownerId
                        }
                    }

                    if (fetchedProject) {
                        employeeQuery = {
                            ID: fetchedProject['Assigned']
                        };
                        customerQuery = {
                            ID: fetchedProject['Company']
                        };

                        function customerFinder (callback) {
                            Customer.findOne(customerQuery, {_id: 1}, function (err, customer) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null, customer);
                            });
                        };

                        function employeeFinder (callback) {
                            Employee.findOne(employeeQuery, {_id: 1}, function (err, employee) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null, employee);
                            });
                        }

                        async.parallel({
                            customerResult: customerFinder,
                            employeeResult: employeeFinder
                        }, function(err, result) {
                            objectToSave.customer = result.customerResult._id;
                            objectToSave.employee = result.employeeResult._id;
                            model = new Model(objectToSave);
                            model.save(cb);
                        });
                    }
                }, 100);

                q.drain = function () {
                    callback(null, 'done');
                };

                async.each(fetchedArray, function (fetchedCustomer) {
                    q.push(fetchedCustomer, function () {
                        console.log('finished ' + fetchedCustomer.ID);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, 'Completed');
                })
            }

            waterfallTasks = [getData, saverProject];

            async.waterfall(waterfallTasks, function (err, result) {
                if (err) {
                    seriesCb(err);
                }

                seriesCb(null, 'Complete')
            });
        };

        function projectImporter(callback) {
            importProject(projectShema, callback);
        };

        function customerImporter(callback) {
            importCustomer(customerSchema, callback);
        };

        return [customerImporter, projectImporter];
    };

    function hrImporter(req, tasks) {
        var departmentShema = tasks[0];
        var jobPositionShema = tasks[1];
        var employeeShema = tasks[2];
        var ownerId = req.session ? req.session.uId : null;

        function importDepartment(departmentShema, seriesCb) {
            var query = queryBuilder(departmentShema.table);
            var waterfallTasks;

            function getData(callback) {
                handler.importData(query, callback);
            }

            function saverDepartment(fetchedArray, callback) {
                var collection = departmentShema.collection;
                var Schema = mongoose.Schemas[collection];
                var Model = models.get(req.session.lastDb, collection, Schema);
                var model;

                var mongooseFields = Object.keys(departmentShema.aliases);

                var q = async.queue(function (fetchedDepartment, cb) {
                    var objectToSave = {};

                    for (var i = mongooseFields.length - 1; i >= 0; i--) {
                        var key = mongooseFields[i];
                        var msSqlKey = departmentShema.aliases[key];

                        objectToSave[key] = fetchedDepartment[msSqlKey];
                        objectToSave.createdBy = {
                            user: ownerId
                        };
                        objectToSave.editedBy = {
                            user: ownerId
                        }
                    }

                    if (fetchedDepartment) {
                        model = new Model(objectToSave);
                        model.save(cb);
                    }
                }, 100);

                q.drain = function () {
                    callback(null, 'done');
                };

                async.each(fetchedArray, function (fetchedDepartment) {
                    q.push(fetchedDepartment, function () {
                        console.log('finished ' + fetchedDepartment.ID);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, 'Completed');
                })
            }

            waterfallTasks = [getData, saverDepartment];

            async.waterfall(waterfallTasks, function (err, result) {
                if (err) {
                    seriesCb(err);
                }

                seriesCb(null, 'Complete')
            });
        }

        function importJobPosition(jobPositionShema, seriesCb) {
            var query = queryBuilder(jobPositionShema.table);
            var waterfallTasks;

            function getData(callback) {
                handler.importData(query, callback);
            }

            function saverJobPosition(fetchedArray, callback) {
                var collection = jobPositionShema.collection;
                var departmentCollection = departmentShema.collection;
                var Schema = mongoose.Schemas[collection];
                var DepartmentSchema = mongoose.Schemas[departmentCollection];
                var Model = models.get(req.session.lastDb, collection, Schema);
                var Department = models.get(req.session.lastDb, departmentCollection, DepartmentSchema);
                var model;

                var mongooseFields = Object.keys(jobPositionShema.aliases);

                var q = async.queue(function (fetchedJobPosition, cb) {
                    var objectToSave = {};
                    var departmentQuery;

                    for (var i = mongooseFields.length - 1; i >= 0; i--) {
                        var key = mongooseFields[i];
                        var msSqlKey = jobPositionShema.aliases[key];

                        if (msSqlKey in jobPositionShema.comparator) {
                            fetchedJobPosition[msSqlKey] = comparator(fetchedJobPosition[msSqlKey], jobPositionShema.comparator[msSqlKey]);
                        }

                        objectToSave[key] = fetchedJobPosition[msSqlKey];
                        objectToSave.createdBy = {
                            user: ownerId
                        };
                        objectToSave.editedBy = {
                            user: ownerId
                        }
                    }

                    if (fetchedJobPosition) {
                        departmentQuery = {
                            ID: fetchedJobPosition['Department']
                        };
                        Department.findOne(departmentQuery, {_id: 1}, function (err, department) {
                            if (err) {
                                return cb(err);
                            }

                            objectToSave.department = department._id;

                            model = new Model(objectToSave);
                            model.save(cb);
                        });
                    }
                }, 100);

                q.drain = function () {
                    callback(null, 'done');
                };

                async.each(fetchedArray, function (fetchedDepartment) {
                    q.push(fetchedDepartment, function () {
                        console.log('finished ' + fetchedDepartment.ID);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, 'Completed');
                })
            }

            waterfallTasks = [getData, saverJobPosition];

            async.waterfall(waterfallTasks, function (err, result) {
                if (err) {
                    seriesCb(err);
                }

                seriesCb(null, 'Complete')
            });
        }

        function jobPositionImporter(callback) {
            importJobPosition(jobPositionShema, callback);
        }

        function departmentImporter(callback) {
            importDepartment(departmentShema, callback);
        }

        return [departmentImporter, jobPositionImporter];
    }

    router.post('/', function (req, res, next) {
        var hrTasks = hrImporter(req, tasks);
        var salesTasks = salesImporter(req, tasks);
        var seriesTasks = hrTasks.concat(salesTasks);
        /*handler.importData("SELECT * FROM Employee", function(err, employees){
         if(err){
         return next(err);
         }

         res.status(200).send(employees);
         });*/

        async.series(seriesTasks, function (err) {
            if (err) {
                return next(err);
            }

            res.status(200).send('Imported success');
        });

    });

    return router;
};