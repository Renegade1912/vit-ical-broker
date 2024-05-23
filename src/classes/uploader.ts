import axios, { AxiosInstance, AxiosPromise } from "axios";
import { CalendarEvent } from "../types";

/**
 * Represents an uploader for handling file uploads.
 */
export class Uploader {
  client: AxiosInstance;
  isGetActiveSessionRequest: boolean = false;
  requestQueue: ((cookie: string) => void)[] = [];

  /**
   * Creates a new instance of the Uploader class.
   */
  constructor() {
    // Create a new axios instance
    this.client = axios.create({
      baseURL: process.env.API_URL,
      timeout: 7500,
    });

    // Add a request interceptor to handle not authorized errors
    this.client.interceptors.response.use(null, async (error) => {
      const { response = {}, config: sourceConfig } = error;

      if (response.status === 403) {
        console.log("No Session, creating a new session ...");

        if (!this.isGetActiveSessionRequest) {
          this.isGetActiveSessionRequest = true;

          this.createSession()
            .then((cookie) => {
              this.isGetActiveSessionRequest = false;
              this.callRequestFromQueue(cookie);
              this.clearQueue();
            })
            .catch((error) => {
              this.isGetActiveSessionRequest = false;
              console.error("Create session error %s!", error.message);
              this.clearQueue();
            });

          const retryRequest = new Promise((resolve) => {
            this.addRequestToQueue((cookie: any) => {
              console.log(
                "Retry with new cookie %s request to %s ...",
                sourceConfig.method,
                sourceConfig.url
              );
              sourceConfig.headers.Cookie = cookie;
              resolve(axios(sourceConfig));
            });
          });

          return retryRequest;
        }
      } else {
        return Promise.reject(error);
      }
    });
  }

  /**
   * Calls the request from the queue with the provided cookie.
   * @param cookie - The cookie to be passed to the request.
   */
  callRequestFromQueue(cookie: string) {
    this.requestQueue.forEach((sub: (cookie: string) => void) => sub(cookie));
  }

  /**
   * Adds a request to the queue.
   * @param sub - A callback function that accepts a cookie string as a parameter.
   */
  addRequestToQueue(sub: (cookie: string) => void) {
    this.requestQueue.push(sub);
  }

  /**
   * Clears the request queue.
   */
  clearQueue() {
    this.requestQueue = [];
  }

  /**
   * Creates a session for the API.
   * @returns {Promise<string>} A promise that resolves to the session cookie.
   */
  async createSession(): Promise<string> {
    const authParams = {
      user: process.env.API_USER,
      password: process.env.API_PASS,
    };

    const response = await this.client.post("/login", authParams);
    const [cookie] = response.headers["set-cookie"] as string[];
    this.client.defaults.headers.Cookie = cookie;

    return cookie;
  }

  /**
   * Uploads JSON data to the server.
   * @param {string} mac - The MAC address of the device.
   * @param {CalendarEvent[]} events - An array of calendar events to upload.
   * @returns {Promise<AxiosPromise>} - A AxiosPromise that resolves when the upload is complete.
   */
  public async uploadJSON(
    mac: string,
    events: CalendarEvent[]
  ): Promise<AxiosPromise> {
    const buildedEvents = events.map((event) => {
      return [`${event.start}-${event.end}`, event.description];
    });

    const envelope = {
      mac,
      schedule: {
        room: events[0].location,
        date: events[0].date,
        entries: buildedEvents,
      },
    };

    return this.client.post(`/upload-schedule`, envelope);
  }
}
