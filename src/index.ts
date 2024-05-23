import "dotenv/config";
import { createHash } from "node:crypto";
import axios, { AxiosError, AxiosResponse } from "axios";
import { calendars, locations } from "./static";
import { Uploader } from "./classes/uploader";
import { CalendarEvent, ICSObject, VITCalendar } from "./types";

// @ts-ignore - ical is not typed
import ical from "ical";
// @ts-ignore - node-cron is not typed
import cron from "node-cron";

const Client = new Uploader();

let needsUpdate = false;

/**
 * Fetches the calendar data for a given VITCalendar.
 *
 * @param calendar - The VITCalendar object containing the year, section, and class.
 * @returns A Promise that resolves to the AxiosResponse containing the calendar data.
 */
function fetchSingleCalendar(calendar: VITCalendar): Promise<AxiosResponse> {
  return axios.get(
    process.env.ICAL_URL?.replace("{year}", calendar.year.toString())
      .replace("{section}", calendar.section)
      .replace("{class}", calendar.class) as string,

    {
      auth: {
        username: process.env.ICAL_USER as string,
        password: process.env.ICAL_PASS as string,
      },
    }
  );
}

/**
 * Fetches all calendars and updates the events array for each calendar.
 */
function fetchAllCalendars(): Promise<void> {
  // Fetch all calendars with promises
  return Promise.all(calendars.map((calendar) => fetchSingleCalendar(calendar)))
    .then((responses: AxiosResponse[]) => {
      for (let i = 0; i < responses.length; i++) {
        const calendarData = responses[i].data;
        const events: ICSObject[] = ical.parseICS(calendarData);

        // Clean/reset the events array
        calendars[i].events = [];

        for (const event of Object.values(events)) {
          if (event.type !== "VEVENT") {
            continue;
          }

          // Get room number from summary
          const location = JSON.stringify(event.summary).match(/Raum: (\d+)/);

          // skip if no location is found
          if (!location) {
            continue;
          }

          // Trim leading zeros
          if (location) {
            location[1] = location[1].replace(/^0+/, "");
          }

          // Parse start and end to Date
          const start = new Date(event.start);
          const end = new Date(event.end);

          // Build the event object
          const eventObj: CalendarEvent = {
            uid: event.uid,
            date: `${("0" + start.getDate()).slice(-2)}.${(
              "0" +
              (start.getMonth() + 1)
            ).slice(-2)}.${start.getFullYear()}`,
            start: `${("0" + start.getHours()).slice(-2)}:${(
              "0" + start.getMinutes()
            ).slice(-2)}`,
            end: `${("0" + end.getHours()).slice(-2)}:${(
              "0" + end.getMinutes()
            ).slice(-2)}`,
            description: event.description,
            location: location?.[1],
          };

          // Push the event to the calendar
          calendars[i].events.push(eventObj);
        }

        // Hash of todays events to identify changes today
        const today = new Date();
        const todayString = `${("0" + today.getDate()).slice(-2)}.${(
          "0" +
          (today.getMonth() + 1)
        ).slice(-2)}.${today.getFullYear()}`;
        const eventsToday = calendars[i].events.filter(
          (event) => event.date === todayString
        );

        const hash = createHash("sha1")
          .update(JSON.stringify(eventsToday))
          .digest("hex");

        if (calendars[i].hash !== hash) needsUpdate = true;

        calendars[i].hash = hash;
      }
    })
    .finally(() => {
      if (needsUpdate) {
        needsUpdate = false;
        console.log("Updateing screens ...");
        updateScreens();
        return;
      }

      console.log("No updates found ...");
    });
}

async function updateScreens() {
  // Merge all events into one array
  const events: CalendarEvent[] = calendars.reduce(
    (acc: CalendarEvent[], calendar: VITCalendar) => {
      return acc.concat(calendar.events);
    },
    []
  );

  const today = new Date();
  const todayString = `${("0" + today.getDate()).slice(-2)}.${(
    "0" +
    (today.getMonth() + 1)
  ).slice(-2)}.${today.getFullYear()}`;

  // Get the locations for the events
  const locationsForEvents = events.map((event) => event.location);
  const uniqueLocations = Array.from(new Set(locationsForEvents));

  // Upload JSON for each location
  for (const location of uniqueLocations) {
    const macs: string[] = locations[location];

    // Skip if no screens are found for the location
    if (!macs) {
      console.log(`No screens found for location ${location}! Skipping ...`);
      continue;
    }

    const eventsForLocation = events.filter(
      (event) => event.location === location && event.date === todayString
    );

    // Order events by start time
    eventsForLocation.sort((a, b) => {
      return a.start.localeCompare(b.start);
    });

    for (const mac of macs) {
      try {
        await Client.uploadJSON(mac, eventsForLocation);
      } catch (err: unknown) {
        const error = err as AxiosError;

        if (error.code === "ECONNABORTED") {
          console.error("Failed to upload JSON for mac due timeout:", mac);
          needsUpdate = true;
        }
      }
    }
  }
}

async function main() {
  // Initialize the calendar data
  console.log("Initialize calendar data ...");
  await fetchAllCalendars();

  // Update the calendar data every 5 minutes
  cron.schedule("* * * * *", () => {
    console.log("Checking for updates ...");
    fetchAllCalendars();
  });
}

main();
