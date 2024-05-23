import { VITCalendar } from "./types";

// Define the devices for locations (rooms)
// toDo: Get from database, file or smth like that
export const locations: { [key: string]: string[] } = {
  "2": ["0000021E733A7430"],
  "4": ["0000021E8D837433"],
};

// Define the calendars to fetch
// toDo: Get from database, file or smth like that
export const calendars: VITCalendar[] = [
  {
    class: "k01",
    year: 2021,
    section: "h3",
    events: [],
  },
  {
    class: "k02",
    year: 2021,
    section: "h3",
    events: [],
  },
];
