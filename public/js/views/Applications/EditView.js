﻿define([
    'Backbone',
    'jQuery',
    'Underscore',
    'text!templates/Applications/EditTemplate.html',
    'views/selectView/selectView',
    'views/Notes/AttachView',
    'views/Assignees/AssigneesView',
    'common',
    'populate',
    'custom',
    'constants'
], function (Backbone, $, _, EditTemplate, SelectView, AttachView, AssigneesView, common, populate, custom, CONSTANTS) {
    'use strict';
    var EditView = Backbone.View.extend({
        el         : "#content-holder",
        contentType: "Applications",
        imageSrc   : '',
        template   : _.template(EditTemplate),

        initialize: function (options) {
            this.mId =  CONSTANTS.MID[this.contentType];
            _.bindAll(this, "saveItem");
            _.bindAll(this, "render", "deleteItem");
            this.employeesCollection = options.collection;
            this.currentModel = options.model || options.collection.getElement();
            this.currentModel.urlRoot = "/applications";
            this.responseObj = {};
            this.refuseId = 0;

            this.responseObj['#sourceDd'] = [
                {
                    _id : 'www.rabota.ua',
                    name: 'www.rabota.ua'
                }, {
                    _id : 'www.work.ua',
                    name: 'www.work.ua'
                }, {
                    _id : 'www.ain.net',
                    name: 'www.ain.net'
                }, {
                    _id : 'other',
                    name: 'other'
                }
            ];

            this.responseObj['#genderDd'] = [
                {
                    _id : 'male',
                    name: 'male'
                }, {
                    _id : 'female',
                    name: 'female'
                }
            ];
            this.responseObj['#maritalDd'] = [
                {
                    _id : 'married',
                    name: 'married'
                }, {
                    _id : 'unmarried',
                    name: 'unmarried'
                }
            ];

            this.render();
        },

        events: {
            "click #tabList a"                                 : "switchTab",
            "click .breadcrumb a, #refuse"                     : "changeWorkflow",
            "change #workflowNames"                            : "changeWorkflows",
            'keydown'                                          : 'keydownHandler',
            "mouseenter .avatar"                               : "showEdit",
            "mouseleave .avatar"                               : "hideEdit",
            "click .current-selected"                          : "showNewSelect",
            "click"                                            : "hideNewSelect",
            'click .dialog-tabs a'                             : 'changeTab',
            "click .newSelectList li:not(.miniStylePagination)": "chooseOption",
            "click .hireEmployee"                              : "isEmployee",
            "click .refuseEmployee"                            : "refuseEmployee",
            "click td.editable"                                : "editJob"
        },

        editJob: function (e) {
            var self = this;
            var $target = $(e.target);
            var dataId = $target.attr('data-id');
            var tempContainer;

            tempContainer = ($target.text()).trim();
            $target.html('<input class="editing" type="text" value="' + tempContainer + '">');

            if (dataId === 'salary') {
                return false;
            }

            $target.find('.editing').datepicker({
                dateFormat : "d M, yy",
                changeMonth: true,
                changeYear : true,
                onSelect   : function () {
                    var editingDates = self.$el.find('.editing');

                    editingDates.each(function () {
                        $(this).parent().text($(this).val());
                        $(this).remove();
                    });
                }
            }).addClass('datepicker');

            return false;
        },

        refuseEmployee: function (e) {
            e.preventDefault();

            var self = this;
            var workflowStart = this.currentModel.get("workflow") && this.currentModel.get("workflow")._id ? this.currentModel.get("workflow")._id : this.currentModel.get("workflow");

            this.currentModel.save({
                workflow: self.refuseId
            }, {
                patch  : true,
                success: function (model) {
                    model = model.toJSON();
                    var viewType = custom.getCurrentVT();
                    switch (viewType) {
                        case 'list':
                        {
                            $("tr[data-id='" + model._id + "'] td").eq(6).find("a").text("Refused");
                        }
                            break;
                        case 'kanban':
                        {
                            $(".column[data-id='" + self.refuseId + "']").find(".columnNameDiv").after($("#" + model._id));
                            if (self.refuseId) {
                                var counter = $(".column[data-id='" + self.refuseId + "']").closest(".column").find(".totalCount");
                                counter.html(parseInt(counter.html()) + 1);
                                counter = $(".column[data-id='" + workflowStart + "']").closest(".column").find(".totalCount");
                                counter.html(parseInt(counter.html()) - 1);

                            }

                        }
                    }
                    self.hideDialog();
                },
                error  : function (model, xhr) {
                    self.errorNotification(xhr);
                }
            });
            return false;

        },

        isEmployee: function (e) {
            e.preventDefault();
            var hired = {};
            var mid = this.mId;

            hired.date = new Date();
            hired.department = this.$el.find("#department").attr("data-id") || null;
            hired.jobPosition = this.$el.find("#jobPosition").attr("data-id") || null;
            hired.manager = this.$el.find("#manager").attr("data-id") || null;
            hired.jobType = this.$el.find("#jobType").attr("data-id") || null;

            this.currentModel.save({
                isEmployee: true,
                hired     : hired
            }, {
                headers: {
                    mid: mid
                },
                patch  : true,
                success: function () {
                    Backbone.history.navigate("easyErp/Employees", {trigger: true});
                }
            });
        },

        changeTab: function (e) {
            var holder = $(e.target);
            var n;
            var dialog_holder;

            holder.closest(".dialog-tabs").find("a.active").removeClass("active");
            holder.addClass("active");
            n = holder.parents(".dialog-tabs").find("li").index(holder.parent());
            dialog_holder = $(".dialog-tabs-items");
            dialog_holder.find(".dialog-tabs-item.active").removeClass("active");
            dialog_holder.find(".dialog-tabs-item").eq(n).addClass("active");
        },

        keydownHandler: function (e) {
            switch (e.which) {
                case 27:
                    this.hideDialog();
                    break;
                default:
                    break;
            }
        },

        getWorkflowValue: function (value) {
            var workflows = [];
            var i;

            for (i = 0; i < value.length; i++) {
                workflows.push({name: value[i].name, status: value[i].status});
            }
            return workflows;
        },

        switchTab: function (e) {
            e.preventDefault();

            var link = this.$("#tabList a");
            var index;

            if (link.hasClass("selected")) {
                link.removeClass("selected");
            }

            index = link.index($(e.target).addClass("selected"));
            this.$(".tab").hide().eq(index).show();
        },

        hideDialog: function () {
            $(".edit-dialog").remove();
            $(".add-group-dialog").remove();
            $(".add-user-dialog").remove();
            $(".crop-images-dialog").remove();
        },

        showEdit: function () {
            $(".upload").animate({
                height : "20px",
                display: "block"
            }, 250);
        },

        hideEdit: function () {
            $(".upload").animate({
                height : "0px",
                display: "block"
            }, 250);

        },

        saveItem  : function () {
            var self = this;
            var mid = this.mId;
            var lengthHire;
            var jobType;
            var department;
            var jobPosition;
            var manager;
            var el = this.$el;
            var name = {
                first: $.trim(this.$el.find("#first").val()),
                last : $.trim(this.$el.find("#last").val())
            };
            var gender = $("#genderDd").data("id") || null;
            var marital = $("#maritalDd").data("id") || null;
            var workAddress = {
                street : $.trim(el.find('#street').val()),
                city   : $.trim(el.find('#city').val()),
                state  : $.trim(el.find('#state').val()),
                zip    : $.trim(el.find('#zip').val()),
                country: $.trim(el.find('#country').val())
            };
            var social = {
                LI: $.trim(el.find('#LI').val()),
                FB: $.trim(el.find('#FB').val())
            };
            var tags = $.trim(el.find("#tags").val()).split(',');
            var workEmail = $.trim(el.find("#workEmail").val());
            var personalEmail = $.trim(el.find("#personalEmail").val());
            var skype = $.trim(el.find("#skype").val());
            var workPhones = {
                phone : $.trim(el.find("#phone").val()),
                mobile: $.trim(el.find("#mobile").val())
            };
            var bankAccountNo = $.trim($("#bankAccountNo").val());
            var relatedUser = el.find("#relatedUsersDd").data("id") || null;
            var identNo = $.trim($("#identNo").val());
            var passportNo = $.trim(el.find("#passportNo").val());
            var otherId = $.trim(el.find("#otherId").val());
            var homeAddress = {};

            $("dd").find(".homeAddress").each(function () {
                var elem = $(this);
                homeAddress[elem.attr("name")] = $.trim(elem.val());
            });

            var dateBirthSt = $.trim(el.find("#dateBirth").val());
            var sourceId = $("#sourceDd").data("id");
            var nationality = $("#nationality").data("id");
            var usersId = [];
            var groupsId = [];

            $(".groupsAndUser tr").each(function () {
                if ($(this).data("type") === "targetUsers") {
                    usersId.push($(this).data("id"));
                }
                if ($(this).data("type") === "targetGroups") {
                    groupsId.push($(this).data("id"));
                }

            });

            var groups = {
                owner: $("#allUsersSelect").data("id"),
                users: usersId,
                group: groupsId
            };
            var whoCanRW = el.find("[name='whoCanRW']:checked").val();
            var hireArray = this.currentModel.get('hire');
            var fireArray = this.currentModel.get('fire');
            var newFire = _.clone(fireArray);
            var newFireArray = [];

            _.each(fireArray, function (fire, key) {
                var tr = self.$el.find("#fire" + key);
                var date = new Date($.trim(tr.find("[data-id='fireDate']").text()));
                var info = tr.find('#statusInfoDd').val();

                if (key === fireArray.length - 1) {
                    newFire[key] = _.clone(fireArray[key]);

                    newFire[key].date = date;
                    newFire[key].info = info;

                    newFireArray.push(newFire[key]);
                } else {
                    newFireArray.push(newFire[key]);
                }

                return newFireArray;
            });

            lengthHire = hireArray.length;
            jobPosition = hireArray[lengthHire - 1].jobPosition;
            department = hireArray[lengthHire - 1].department;
            manager = hireArray[lengthHire - 1].manager;
            jobType = hireArray[lengthHire - 1].jobType;

            var referredBy = $.trim(el.find("#referredBy").val());
            var expectedSalary = $.trim(el.find("#expectedSalary").val());
            var proposedSalary = parseInt($.trim(el.find("#proposedSalary").val()), 10);
            var viewType = custom.getCurrentVT();
            var nextAction = $.trim(this.$el.find("#nextAction").val());

            var data = {

                name          : name,
                gender        : gender,
                jobType       : jobType,
                marital       : marital,
                workAddress   : workAddress,
                social        : social,
                tags          : tags,
                workEmail     : workEmail,
                personalEmail : personalEmail,
                skype         : skype,
                workPhones    : workPhones,
                bankAccountNo : bankAccountNo,
                relatedUser   : relatedUser,
                department    : department,
                jobPosition   : jobPosition,
                manager       : manager,
                identNo       : identNo,
                passportNo    : passportNo,
                otherId       : otherId,
                homeAddress   : homeAddress,
                dateBirth     : dateBirthSt,
                source        : sourceId,
                imageSrc      : this.imageSrc,
                nationality   : nationality,
                groups        : groups,
                whoCanRW      : whoCanRW,
                hire          : hireArray,
                fire          : newFireArray,
                nextAction    : nextAction,
                referredBy    : referredBy,
                expectedSalary: expectedSalary,
                proposedSalary: proposedSalary
            };

            var workflowId = el.find("#workflowsDd").data("id");
            var workflow = workflowId || null;
            var currentWorkflow = this.currentModel.get('workflow');
            if (currentWorkflow && currentWorkflow._id && (currentWorkflow._id !== workflow)) {
                data.workflow = workflow;
                data.sequence = -1;
                data.sequenceStart = this.currentModel.toJSON().sequence;
                data.workflowStart = currentWorkflow._id;
            }

            this.currentModel.save(data, {
                headers: {
                    mid: mid
                },
                patch  : true,
                success: function (model, result) {
                    model = model.toJSON();
                    result = result.result;
                    switch (viewType) {
                        case 'list':
                        {
                            var tr_holder = $("tr[data-id='" + model._id + "'] td");
                            tr_holder.eq(2).text(data.name.first + " " + data.name.last);
                            tr_holder.eq(3).text(data.personalEmail);
                            tr_holder.eq(4).find("a").text(data.workPhones.phone).attr("href", "skype:" + data.workPhones.phone + "?call");
                            tr_holder.eq(5).text(self.$el.find("#jobPositionDd").text());
                            tr_holder.eq(6).find("a").text(self.$el.find("#workflowsDd").text());
                            tr_holder.eq(7).text(data.jobType);
                            if (data.workflow) {
                                Backbone.history.fragment = "";
                                Backbone.history.navigate(window.location.hash.replace("#", ""), {trigger: true});
                            }
                        }
                            break;
                        case 'kanban':
                        {
                            var kanban_holder = $("#" + model._id);
                            kanban_holder.find(".application-header .left").html(data.name.first + "<br/>" + data.name.last);
                            if (parseInt(data.proposedSalary)) {
                                kanban_holder.find(".application-header .right").text(data.proposedSalary + "$");
                            }
                            kanban_holder.find(".application-content p.center").text(self.$el.find("#jobPositionDd").text());
                            kanban_holder.find(".application-content p.right").text(nextAction);
                            if (new Date() > new Date(nextAction)) {
                                kanban_holder.find(".application-content p.right").addClass("red");
                            } else {
                                kanban_holder.find(".application-content p.right").removeClass("red");
                            }

                            if (result && result.sequence) {
                                $("#" + data.workflowStart).find(".item").each(function () {
                                    var seq = $(this).find(".inner").data("sequence");
                                    if (seq > data.sequenceStart) {
                                        $(this).find(".inner").attr("data-sequence", seq - 1);
                                    }
                                });
                                kanban_holder.find(".inner").attr("data-sequence", result.sequence);
                            }
                            if (data.workflow) {
                                $(".column[data-id='" + data.workflow + "']").find(".columnNameDiv").after(kanban_holder);
                                var counter = $(".column[data-id='" + data.workflow + "']").closest(".column").find(".totalCount");
                                counter.html(parseInt(counter.html()) + 1);
                                counter = $(".column[data-id='" + data.workflowStart + "']").closest(".column").find(".totalCount");
                                counter.html(parseInt(counter.html()) - 1);

                            }
                            $(".column[data-id='" + data.workflow + "']").find(".columnNameDiv").after(kanban_holder);

                        }
                    }
                    self.hideDialog();
                },
                error  : function (model, xhr) {
                    self.errorNotification(xhr);
                }
            });
        },
        deleteItem: function (event) {
            event.preventDefault();

            var mid = this.mId;
            var self = this;
            var answer = confirm("Really DELETE items ?!");

            if (answer === true) {
                this.currentModel.destroy({
                    headers: {
                        mid: mid
                    },
                    success: function (model) {
                        model = model.toJSON();
                        var viewType = custom.getCurrentVT();
                        switch (viewType) {
                            case 'list':
                            {
                                $("tr[data-id='" + model._id + "'] td").remove();
                            }
                                break;
                            case 'kanban':
                            {
                                $("#" + model._id).remove();
                                var wId = model.workflow._id;
                                var total$ = $("td[data-id='" + wId + "'] .totalCount");
                                var newTotal = total$.html() - 1;
                                total$.html(newTotal);
                            }
                        }
                        self.hideDialog();
                    },
                    error  : function (model, xhr) {
                        self.errorNotification(xhr);
                    }
                });
            }
        },

        hideNewSelect: function () {
            var editingDates = this.$el.find('.editing');

            editingDates.each(function () {
                $(this).parent().text($(this).val());
                $(this).remove();
            });

            this.$el.find('.newSelectList').hide();

            if (this.selectView) {
                this.selectView.remove();
            }
        },

        showNewSelect: function (e) {
            var $target = $(e.target);
            e.stopPropagation();

            if ($target.attr('id') === 'selectInput') {
                return false;
            }

            if (this.selectView) {
                this.selectView.remove();
            }

            this.selectView = new SelectView({
                e          : e,
                responseObj: this.responseObj
            });

            $target.append(this.selectView.render().el);

            return false;
        },

        chooseOption: function (e) {

            $(e.target).parents("dd").find(".current-selected").text($(e.target).text()).attr("data-id", $(e.target).attr("id"));

        },

        render: function () {
            var self = this;
            var notDiv;
            var formString = this.template({
                model: this.currentModel.toJSON()
            });

            this.$el = $(formString).dialog({
                closeOnEscape: false,
                dialogClass  : "edit-dialog",
                width        : 1000,
                title        : "Edit Application",
                buttons      : {
                    save  : {
                        text : "Save",
                        class: "btn",
                        click: self.saveItem
                    },
                    cancel: {
                        text : "Cancel",
                        class: "btn",
                        click: self.hideDialog
                    },
                    delete: {
                        text : "Delete",
                        class: "btn",
                        click: self.deleteItem
                    }
                }
            });

            notDiv = this.$el.find('.attach-container');
            notDiv.append(
                new AttachView({
                    model: this.currentModel,
                    url  : "/uploadApplicationFiles"
                }).render().el
            );
            notDiv = this.$el.find('.assignees-container');
            notDiv.append(
                new AssigneesView({
                    model: this.currentModel
                }).render().el
            );
            populate.getWorkflow("#workflowsDd", "#workflowNamesDd", "/WorkflowsForDd", {id: "Applications"}, "name", this, false, function (data) {
                var i;

                for (i = 0; i < data.length; i++) {
                    if (data[i].name === "Refused") {
                        self.refuseId = data[i]._id;
                        if (self.currentModel && self.currentModel.toJSON().workflow && self.currentModel.toJSON().workflow._id === data[i]._id) {
                            $(".refuseEmployee").hide();
                        }
                        break;
                    }
                }
            });

            populate.get("#departmentsDd", "/department/getForDD", {}, "departmentName", this);
            populate.get("#jobPositionDd", "/JobPositionForDd", {}, "name", this);
            populate.get("#jobTypeDd", "/jobType", {}, "_id", this);
            populate.get("#nationality", "/nationality", {}, "_id", this);
            populate.get2name("#projectManagerDD", "/employees/getPersonsForDd", {}, this);
            populate.get("#relatedUsersDd", "/UsersForDd", {}, "login", this, false, true);

            common.canvasDraw({model: this.currentModel.toJSON()}, this);

            $('#nextAction').datepicker({
                dateFormat : "d M, yy",
                changeMonth: true,
                changeYear : true,
                minDate    : this.currentModel.toJSON().creationDate
            });

            $('#dateBirth').datepicker({
                dateFormat : "d M, yy",
                changeMonth: true,
                changeYear : true,
                yearRange  : '-100y:c+nn',
                maxDate    : '-18y'
            });

            $('.date').datepicker({
                dateFormat : "d M, yy",
                changeMonth: true,
                changeYear : true
            });

            var model = this.currentModel.toJSON();
            if (model.groups) {
                if (model.groups.users.length > 0 || model.groups.group.length) {
                    $(".groupsAndUser").show();
                    model.groups.group.forEach(function (item) {
                        $(".groupsAndUser").append("<tr data-type='targetGroups' data-id='" + item._id + "'><td>" + item.departmentName + "</td><td class='text-right'></td></tr>");
                        $("#targetGroups").append("<li id='" + item._id + "'>" + item.departmentName + "</li>");
                    });
                    model.groups.users.forEach(function (item) {
                        $(".groupsAndUser").append("<tr data-type='targetUsers' data-id='" + item._id + "'><td>" + item.login + "</td><td class='text-right'></td></tr>");
                        $("#targetUsers").append("<li id='" + item._id + "'>" + item.login + "</li>");
                    });

                }
            }
            return this;
        }
    });
    return EditView;
});
