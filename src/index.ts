import "dotenv/config";
import axios from "axios";

axios
  .get("https://www.fbfinanzen.de/ical/vit/2021/2/h3/k01", {
    auth: {
      username: process.env.ICAL_USER as string,
      password: process.env.ICAL_PASS as string,
    },
  })
  .then(function (response) {
    // handle success
    console.log(response);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  });
