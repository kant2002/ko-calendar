(function (root, factory) {

    // AMD / require.js
    if (typeof define === 'function' && define.amd) {
        define(['knockout', 'moment'], function (ko, moment) {
            factory.call(root, window, document, ko, moment);
        });
    } else {
        factory.call(root, window, document, ko, moment);
    }

})(this, function (win, doc, ko, moment) {

    var binding = 'calendar';

    // Core utils
    var utils = {
        deepExtend: function (destination, source) {
            var property;
            for (property in source) {
                if (source[property] && source[property].constructor && source[property].constructor === Object) {
                    destination[property] = destination[property] || {};
                    utils.deepExtend(destination[property], source[property]);
                } else {
                    destination[property] = source[property];
                }
            }
            return destination;
        },
        isBoolean: function (obj) {
            return typeof (obj) === 'boolean';
        }
    };

    var Model = function (params) {
        var self = this;

        var _locale = params && params.locale ? params.locale : moment.locale();
        moment.locale(_locale);

        var _mLocalDate = moment.localeData();
        var _mLts = _mLocalDate.longDateFormat('LTS');

        var _militaryTime = params && utils.isBoolean(params.militaryTime) ? params.militaryTime : _mLts.charAt(_mLts.length - 1) !== 'A';
        var _months = _mLocalDate.months();
        var _days = _mLocalDate.weekdaysMin().slice(0);
        var _firstDay = _mLocalDate.firstDayOfWeek().slice(0);

        var _showTime = params && utils.isBoolean(params.showTime) ? params.showTime : true;

        var _format;
        if (params && params.format) {
            _format = params.format;
        } else if (_showTime) {
            _format = 'L LTS';
        } else {
            _format = 'L';
        }

        self.opts = {
            value: ko.observable(),
            current: moment(),

            deselectable: true,

            showCalendar: true,
            showToday: true,

            showTime: _showTime,
            showNow: true,
            militaryTime: _militaryTime,

            min: null,
            max: null,

            autoclose: true,

            firstDay: _firstDay,

            locale: _locale,
            format: _format,
            strings: {
                months: _months, //set depends on locale
                days: _days, //set depends on locale
                time: ['AM', 'PM']
            }
        };



        utils.deepExtend(self.opts, params);

        if(!self.opts.showCalendar && !self.opts.showTime) {
            return console.error('Silly goose, what are you using ko-%s for?', binding);
        }

        self.constants = {
            daysInWeek: 7,
            dayStringLength: 2
        };

        self.dayLabels = self.opts.strings.days;

        if (self.opts.firstDay > 0 && self.opts.firstDay <= 6) {
            self.dayLabels = self.dayLabels.splice(self.opts.firstDay).concat(self.dayLabels);
        }

        // Model utils
        self.utils = {

            date: {

                /**
                 * Takes a string and returns true/false depending on whether
                 * or not the date is valid
                 * @param  {String}  dateString The date string to attempt to parse
                 * @return {Boolean}            True if the date is valid, false otherwise
                 */
                isValid: function(dateString) {
                    var date = moment(dateString);
                    return date.isValid();
                },

                /**
                 * Takes a given date and sets the time to midnight
                 * @param  {moment} d The moment object to normalize
                 * @return {moment}   The normalized moment object
                 */
                normalize: function(d) {
                    var normalized = d.clone();
                    normalized.hours(0).minutes(0).seconds(0).milliseconds(0);
                    return normalized;
                },

                /**
                 * Checks if two moment objects are on the same day
                 * @param  {moment}  d1 The first date
                 * @param  {moment}  d2 The second date
                 * @return {Boolean}    Whether or not the dates share the same day
                 */
                isSame: function(d1, d2) {
                    if(!d1 || !d2) { return false; }
                    return (
                        d1.isSame(d2, 'day') &&
                        d1.isSame(d2, 'month') &&
                        d1.isSame(d2, 'year')
                    );
                },

                /**
                 * Checks if the two moment objects have different months
                 * @param  {moment}  d1 The first date
                 * @param  {moment}  d2 The second date
                 * @return {Boolean}    Whether or not the dates share the same month
                 */
                isSameMonth: function(d1, d2) {
                    if(!d1 || !d2) { return false; }
                    return d1.isSame(d2, 'month');
                },

                /**
                 * Checks if the given date falls on the weekend (Saturday or Sunday)
                 * @param  {moment}  d The date to check
                 * @return {Boolean}   Whether or not the date falls on a weekend
                 */
                isWeekend: function(d) {
                    if(!d) { return false; }
                    return d.day() === 0 || (d.day() == self.constants.daysInWeek - 1);
                },

                /**
                 * Check if the given date falls within the date range
                 * @param {moment} d The date to check
                 * @return {Boolean} Whether or not the date falls within the range
                 */
                isWithinMinMaxDateRange: function(d) {
                    if(!d) { return false; }
                    if(!self.opts.min && !self.opts.max) { return true; }

                    if(self.opts.min && self.utils.date.normalize(self.opts.min) > d) {
                        return false;
                    }
                    if(self.opts.max && self.utils.date.normalize(self.opts.max) < d) {
                        return false;
                    }

                    return true;
                }
            },
            time: {
                handleSuffixCheck: function(date) {
                    var hours = date.hours();
                    if(hours >= 12) {
                        hours -= 12;
                    }
                    else if(hours < 12) {
                        hours += 12;
                    }
                    return date.hours(hours);
                },
                checkMinTimeRange: function(data) {
                    if(!data || !self.value() || (!self.opts.min && !self.opts.max)) { return false; }

                    var d = self.value().clone();

                    if (data.type === 'suffix') { d = self.utils.time.handleSuffixCheck(d); }
                    else if(data.type === 'hours' || data.type === 'minutes') { d.subtract(1, data.type); }

                    if(self.opts.max && self.opts.max < d) { return true; }
                    if(self.opts.min && self.opts.min > d) { return true; }

                    return false;
                },
                checkMaxTimeRange: function(data) {
                    if(!data || !self.value() || (!self.opts.min && !self.opts.max)) { return false; }

                    var d = self.value().clone();

                    if (data.type === 'suffix') { d = self.utils.time.handleSuffixCheck(d); }
                    else if (data.type === 'hours' || data.type === 'minutes') { d.add(1, data.type); }

                    if(self.opts.min && self.opts.min > d) { return true; }
                    if(self.opts.max && self.opts.max < d) { return true; }

                    return false;
                }
            },
            strings: {
                pad: function(n) {
                    return n < 10 ? '0' + n : n;
                }
            },
            element: {
                offset: function(el) {
                    var box = el.getBoundingClientRect();
                    var docEl = doc.documentElement;

                    return {
                        top: box.top + win.pageYOffset - docEl.clientTop,
                        left: box.left + win.pageXOffset - docEl.clientLeft
                    };
                },
                height: function(el) {
                    return el.offsetHeight;
                },
                isDescendant: function(parent, child) {
                    var node = child.parentNode;
                    while (node !== null) {
                        if (node == parent) {
                            return true;
                        }
                        node = node.parentNode;
                    }
                    return false;
                }
            }
        };

        var _now = moment();

        // Date Alias Helpers
        self.current = ko.observable(self.opts.current || _now); // The current sheet Date

        if( !ko.isObservable(self.opts.value) ) {
            return console.error('value must be an observable');
        }

        self.value = self.opts.value; // The selected Date
        self.value().locale(self.opts.locale);
        
        // Hide today button if the min is greater than today or max is less than today
        if (self.opts.showToday && !self.utils.date.isWithinMinMaxDateRange(self.utils.date.normalize(_now))) {
            self.opts.showToday = false;
        }
        // Hide now button if the current time is out of the min-max time range
        if (self.opts.showNow && ((self.opts.min && self.opts.min >= _now) || (self.opts.max && self.opts.max <= _now))) {
            self.opts.showNow = false;
        }


        self.label = ko.computed({
            read: function() {
                var date = self.value();
                if (!(date === null || date === undefined) && moment.isMoment(date)) {
                    return date.format(self.opts.format);
                }
                return null;
            },
            write: function(newDate) {
                if (self.utils.date.isValid(newDate)) {
                    self.value(moment(newDate, self.opts.format));
                } else {
                    self.value(null);
                }
            }
        });

        self.calendar = {

            // Selects a date
            select: function(data, e) {
                if( self.opts.deselectable && self.utils.date.isSame(self.value(), data) ) {
                    return self.value(null);
                }
                if(self.opts.min && self.utils.date.isSame(data, self.opts.min)) {
                    self.value(self.opts.min.clone());
                }
                else {
                    self.value(data.clone());
                }

                if( self.input() && self.opts.autoclose ) {
                    self.visible(false);
                }
            },
            selectToday: function(data, e) {
                var d = self.utils.date.normalize(moment());
                if (!self.utils.date.isSame(self.value(), d)) {
                    self.calendar.select(d);
                    self.current(d);
                    self.value(d);
                }
            },
            next: function() {
                var cur = self.current();
                cur.date(1).add(1, 'month');
                self.current(cur.clone());
            },
            prev: function() {
                var cur = self.current();
                cur.date(1).subtract(1, 'month');
                self.current(cur.clone());
            },
            sheet: ko.computed(function() {

                // Current month set to the first day
                var normalized = self.utils.date.normalize(self.current());
                normalized.date(1);
                var firstDayOfMonth = normalized.day();
                var firstDateOfSheet = normalized.date() - firstDayOfMonth + self.opts.firstDay;
                
                if (firstDayOfMonth < self.opts.firstDay) {
                    firstDateOfSheet -= 7;
                }

                normalized.date(firstDateOfSheet); // Set our date to the first day of the week from the normalized month

                var weeks = [];
                var week = 0;
                var startedMonth = false;
                var completedMonth = false;
                var completedWeek = false;

                while(true) {
                    if(!weeks[week]) { weeks[week] = []; }

                    // If we haven't filled the current week up
                    if(weeks[week].length !== self.constants.daysInWeek) {

                        // Append to the week
                        weeks[week].push(moment(normalized.valueOf()));

                        // And increment the date
                        normalized.add(1, 'day');
                    }

                    // If we've began working within the current month
                    if (normalized.isSame(self.current(), 'month')) { startedMonth = true; }

                    // If we've started our current month and we've changed months (and thus completed it)
                    if (startedMonth && !(normalized.isSame(self.current(), 'month')) ) { completedMonth = true; }

                    // If we've completed our month and we are at the end of the week
                    if(completedMonth && weeks[week].length == self.constants.daysInWeek) { completedWeek = true; }

                    // If we've completed the month and our week
                    if(completedMonth && completedWeek) { break; }

                    // Otherwise, if we're at the end of the week, increment the current week
                    if(weeks[week].length == self.constants.daysInWeek) { week++; }
                }

                return weeks;
            })
        };

        self.time = {
            next: function(data, e) {
                if(!self.value()) { return self.time.selectNow(); }

                self.value(data.set( data.get()+1 ).clone());
            },
            prev: function(data, e) {
                if(!self.value()) { return self.time.selectNow(); }

                self.value(data.set(data.get() + 1).clone());
            },
            selectNow: function() {
                var now = moment();

                self.value(now);
                self.current(now);

                if( self.input() && self.opts.autoclose ) {
                    self.visible(false);
                }
            },
            sheet: ko.observableArray([
                {
                    type: 'hours',
                    get: function() { return self.value().hour(); },
                    set: function (to) { return self.value().hour(to); }
                },
                {
                    type: 'minutes',
                    get: function() { return self.value().minute(); },
                    set: function (to) { return self.value().minute(to); }
                }
            ]),
            text: function(data) {
                if(!self.value()) {
                    return '-';
                }

                switch(data.type) {
                    case 'suffix':
                        return data.get() ? self.opts.strings.time[1] : self.opts.strings.time[0];
                    case 'hours':
                        var hours = data.get();
                        if(!self.opts.militaryTime && (hours > 12 || hours === 0) ) {
                            hours -= 12;
                        }
                        return Math.abs(hours);
                    default:
                        return self.utils.strings.pad(data.get());
                }
            }

        };

        if(!self.opts.militaryTime) {
            self.time.sheet.push({
                type: 'suffix',
                get: function() {
                    if(self.value() && self.value().hour() < 12 ) {
                        return 0;
                    }
                    return 1;
                },

                // This set function is special because we don't care about the `to` parameter
                set: function(to) {
                    var hours = self.value().hour();
                    if(hours >= 12) {
                        hours -= 12;
                    }
                    else if(hours < 12) {
                        hours += 12;
                    }
                    return self.value().hour( hours );
                }
            });
        }

        self.input = ko.observable(false); // Is binding attached to an imput?
        self.visible = ko.observable(true);

        return self;
    };

    var Template =
        '<div class="ko-calendar" data-bind="with: $data, visible: (opts.showCalendar || opts.showTime) && visible(), attr: { \'data-opts\': JSON.stringify(opts) } ">\
            <!-- ko if: opts.showCalendar -->\
            <table data-bind="css: { selected: value } " class="calendar-sheet">\
                <thead>\
                    <tr class="month-header">\
                        <th>\
                            <a href="#" data-bind="click: calendar.prev" class="prev">&laquo;</a>\
                        </th>\
                        <th data-bind="attr: { colspan: constants.daysInWeek - 2 } ">\
                            <b data-bind="text: opts.strings.months[current().month()] + \' \' + current().year()"></b>\
                        </th>\
                        <th>\
                            <a href="#" data-bind="click: calendar.next" class="next">&raquo;</a>\
                        </th>\
                    </tr>\
                    <tr data-bind="foreach: dayLabels">\
                        <th data-bind="text: $data"></th>\
                    </tr>\
                </thead>\
                <tbody data-bind="foreach: calendar.sheet">\
                    <tr class="week" data-bind="foreach: $data">\
                        <td class="day" data-bind="css: { weekend: $parents[1].utils.date.isWeekend($data), today: $parents[1].utils.date.isSame(moment(), $data), inactive: !($parents[1].utils.date.isSameMonth($parents[1].current(), $data)), outofrange: !($parents[1].utils.date.isWithinMinMaxDateRange($data)) } ">\
                            <a href="javascript:;" data-bind="text: $data.date(), attr: { title: $data }, click: $parents[1].calendar.select, css: { active: $parents[1].utils.date.isSame($parents[1].value(), $data) } "></a>\
                        </td>\
                    </tr>\
                </tbody>\
                <!-- ko if: opts.showToday -->\
                    <tfoot>\
                        <tr>\
                            <td data-bind="attr: { colspan: constants.daysInWeek } ">\
                                <a href="javascript:;" data-bind="click: calendar.selectToday">Today</a>\
                            </td>\
                        </tr>\
                    </tfoot>\
                <!-- /ko -->\
            </table>\
            <!-- /ko -->\
            <!-- ko if: opts.showTime -->\
            <table class="time-sheet">\
                <tbody>\
                    <tr data-bind="foreach: time.sheet">\
                        <td data-bind="css: { outofrange: $parent.utils.time.checkMaxTimeRange($data) }">\
                            <a href="#" class="up" data-bind="click: $parent.time.next"></a>\
                        </td>\
                    </tr>\
                    <tr data-bind="foreach: time.sheet">\
                        <td data-bind="css: { colon: $index() === 0, inactive: !$parent.value() }, text: $parent.time.text($data)"></td>\
                    </tr>\
                    <tr data-bind="foreach: time.sheet">\
                        <td data-bind="css: { outofrange: $parent.utils.time.checkMinTimeRange($data) }">\
                            <a href="#" class="down" data-bind="click: $parent.time.prev"></a>\
                        </td>\
                    </tr>\
                </tbody>\
                <!-- ko if: opts.showNow -->\
                    <tfoot>\
                        <tr>\
                            <td data-bind="attr: { colspan: time.sheet().length } ">\
                                <a href="javascript:;" data-bind="click: time.selectNow">Now</a>\
                            </td>\
                        </tr>\
                    </tfoot>\
                <!-- /ko -->\
            </table>\
            <!-- /ko -->\
        </div>';

    var applyCalendar = function(el, opts) {

        var instance = new Model(opts);
        var cal;

        if( el.tagName == 'INPUT' ) {

            // Create our template
            var temp = doc.createElement('div');
            temp.innerHTML = Template;
            cal = temp.children[0];
            doc.body.appendChild(cal);

            instance.input(true);
            instance.visible(false);

            // Position Calendar
            ko.utils.registerEventHandler(el, 'focus', function(e) {
                cal.style.opacity = '0';
                // Push this to the end of the stack so we can get the cal width
                setTimeout(function() {
                    var offset = instance.utils.element.offset(el);
                    var height = instance.utils.element.height(el);
                    var positions = [window.innerWidth - cal.offsetWidth - 20, offset.left];

                    cal.style.position = 'absolute';
                    cal.style.top = (offset.top + height + 5) + 'px';
                    cal.style.left = (Math.min.apply(null, positions)) + 'px';
                    cal.style.opacity = '1';
                });

                // Mark as visible
                instance.visible(true);
            });

            // Kill input/calendar focus
            ko.utils.registerEventHandler(el, 'keydown', function(e) {
                // User has pressed tab
                var cancellers = {
                    9: true, // tab
                    27: true, // escape
                    46: true, // delete
                    13: true // enter
                };
                if( e.which in cancellers ) {
                    instance.visible(false);
                }
            });

            // Clicking outside of an input
            ko.utils.registerEventHandler(doc, 'mousedown', function(e) {
                if(!(
                    e.target == el ||
                    e.target == cal ||
                    instance.utils.element.isDescendant(cal, e.target)
                )) {
                    instance.visible(false);
                } else {
                    el.focus();
                }
            });

            // Unset observable upon certain values
            //ko.utils.registerEventHandler(el, 'blur', function(e) {

            //    if(e.target.value === '') {
            //        return instance.value(null);
            //    }

            //    if (instance.utils.date.isValid(e.target.value)) {
            //        var newDate = moment(e.target.value, instance.opts.format);

            //        if (instance.value() === null || instance.value() === undefined || 
            //            (instance.value() && !(instance.value().isSame(newDate)))
            //        ) {
            //            instance.value(newDate);
            //        }
            //    }
            //});

            ko.applyBindingsToNode(el, { value: instance.label });

        } else {
            el.innerHTML = Template;
            cal = el.children[0]; // The first node in our Template
        }

        ko.applyBindings(instance, cal);
    };

    // Component
    ko.components.register(binding, {
        viewModel: Model,
        template: Template
    });

    // Binding
    ko.bindingHandlers[binding] = {
        init: function(el, opts) {

            applyCalendar(el, ko.unwrap(opts()));

            return {
                controlsDescendantBindings: true
            };
        }
    };

    // JS API
    ko[binding] = applyCalendar;
});
