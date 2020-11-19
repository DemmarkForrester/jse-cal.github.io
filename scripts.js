//import { Calendar } from '@fullcalendar/core';
//import rrulePlugin from '@fullcalendar/rrule';
//import interactionPlugin from '@fullcalendar/interaction';
//import dayGridPlugin from '@fullcalendar/daygrid';
//import listPlugin from '@fullcalendar/list';
//import UIkit from 'uikit';
// import { DateTime } from "luxon";

listing_events.push(
    [
        {
            title: 'BIL APO Opening',
            start: '2020-08-26T09:00:00',
            allDay: false // will make the time show
        },
        {
            title: 'BIL APO Closing',
            start: '2020-09-16T16:00:00',
            allDay: false // will make the time show
        },
        {
            title: 'BIL APO Shares Allotment',
            start: '2020-09-23',
        },
        {
            title: 'CFF 1-10 Stock Split',
            start: '2020-10-13',
        },
         {
             title: 'JAMT 1-3 Stock Split',
             start: '2020-11-30',
         },
        {
            title: 'TROPICAL IPO Opening',
            start: '2020-09-22T09:00:00',
            allDay: false // will make the time show
        },
        {
            title: 'TROPICAL IPO Closing',
            start: '2020-09-22T16:30:00',
            allDay: false // will make the time show
        }
    ])

document.addEventListener('DOMContentLoaded', function () {

    var calendarEl = document.getElementById('calendar');

    var cal = new Calendar(calendarEl, {
        plugins: [rrulePlugin, interactionPlugin, dayGridPlugin, listPlugin],
        selectable: true,
        navLinks: true,
        // showNonCurrentDates: false,
        dayMaxEventRows: true,
        headerToolbar: { end: 'dayGridMonth today prev,next listMonth' },
        eventTimeFormat: { // like '14:30pm'
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
        },
        eventSources: [
            {
                events: dividend_events.flat()
            },
            {
                events: listing_events.flat(), color: 'yellow', textColor: 'black'
            },
            {
                events: [
                    {
                        title: 'RJR - AGM',
                        start: '2020-10-28T10:00:00',
                        end: '2020-10-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'GWEST - AGM',
                        start: '2020-11-16T10:00:00',
                        end: '2020-11-16T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'MEEG - AGM',
                        start: '2020-11-30T14:30:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'JAMT - AGM & EGM',
                        start: '2020-11-17T10:15:00',
                        end: '2020-11-17T13:15:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'JBG - AGM- Ajourned',
                        start: '2020-11-18T14:00:00',
                        end: '2020-11-18T17:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'PTL - AGM',
                        start: '2020-11-28T10:00:00',
                        end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'TJH - AGM',
                        start: '2020-11-24T10:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'CAR - AGM',
                        start: '2020-11-26T14:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'KEX - AGM',
                        start: '2020-12-03T10:30:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
{
                        title: 'MJE - AGM',
                        start: '2020-12-16T14:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
{
                        title: 'ELITE - AGM',
                        start: '2020-12-14T10:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },


                    {
                        title: '1834 - AGM',
                        start: '2020-12-18T10:30:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'CAB - AGM',
                        start: '2020-12-09T18:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'MIL - AGM',
                        start: '2020-12-08T14:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'CPJ - AGM',
                        start: '2021-02-09T15:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'FTNA - AGM',
                        start: '2021-01-06T11:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'PULS - AGM',
                        start: '2021-02-16T10:30:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'WISYNCO - AGM',
                        start: '2021-01-14T10:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                    {
                        title: 'SCI - AGM',
                        start: '2020-12-15T10:00:00',
                        // end: '2020-11-28T13:00:00',
                        allDay: false // will make the time show
                    },
                ], color: 'green', textColor: 'black'
            },
            {
                // #TODO: add way to calculate for sunday and holidays related to easter
                events: [
                    {
                        title: 'New Year\'s Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            byyearday: 1,
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-06-01' // will also accept '20120201'
                            // bymonth: 11,
                            // freq: 'weekly',
                            // interval: 5,
                            // byweekday: ['mo', 'fr'],
                            // dtstart: '2020-02-01', // will also accept '20200201T103000'
                            // until: '2020-06-01' // will also accept '20120201'
                        }
                    },
                    {
                        title: 'Ash Wednesday',
                        start: '2020-02-26',
                        display: 'background'
                    },
                    {
                        title: 'Good Friday',
                        start: '2020-04-10',
                        display: 'background'
                    },
                    {
                        title: 'Easter Monday',
                        start: '2020-04-13',
                        display: 'background'
                    },
                    {
                        title: 'Labour Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            bymonth: 5,
                            bymonthday: 23
                        }
                    },
                    {
                        title: 'Emancipation Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            bymonth: 8,
                            bymonthday: 1
                        }
                    },
                    {
                        title: 'Independence Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            bymonth: 8,
                            bymonthday: 6
                        }
                    },
                    {
                        title: 'National Heroes Day',
                        start: '2020-10-19',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            byweekday: ['mo'],
                            bymonth: 10,
                            bysetpos: 3
                        }
                    },
                    {
                        title: 'Christmas Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            bymonth: 12,
                            bymonthday: 25
                        }
                    },
                    {
                        title: 'Boxing Day',
                        display: 'background',
                        rrule: {
                            freq: 'yearly',
                            dtstart: '1969-01-01', // will also accept '20120201T103000'
                            until: '2030-12-31', // will also accept '20120201'
                            bymonth: 12,
                            bymonthday: 26
                        }
                    },
                ]
                , backgroundColor: 'red', textColor: 'black'
            }
        ],
        eventDidMount: function (info) {
            var tooltip = new UIkit.tooltip(info.el, {
                title: info.event.title,
            });
        },
    });

    cal.render();

    var eventzList = ["change", "focusout"];
    for (const eventz of eventzList) {
        document.getElementById("dateInput").addEventListener(eventz, function () {
            var input = this.value;
            if (input) {
                cal.gotoDate(input);
            } else {
                // cal.today();
            }
        });
    }
});
