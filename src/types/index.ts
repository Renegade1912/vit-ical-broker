export interface ICSObject {
  type: Component;
  params: object;
  uid: Number;
  dtstamp: Date;
  start: Date;
  end: Date;
  summary: Summary;
  organizer: Organizer;
  description: string;
  val: string; // https://www.ietf.org/rfc/rfc2445.txt
}

type Component =
  | "VEVENT"
  | "VTODO"
  | "VJOURNAL"
  | "VFREEBUSY"
  | "VTIMEZONE"
  | "VALARM"
  | "STANDARD"
  | "DAYLIGHT";

type Summary = {
  params: object;
  val: string;
};

type Organizer = {
  params: object;
  val: string; // email
};

export interface VITCalendar {
  class: string;
  year: number;
  section: string;
  events: CalendarEvent[];
  hash?: string;
}

export interface CalendarEvent {
    uid: Number;
    date: string;
    start: string;
    end: string;
    description: string;
    location: string;
}
