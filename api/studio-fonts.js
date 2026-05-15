import { createApiHandler } from "../src/server/create-api-handler.js";

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "4mb",
  },
};

export default createApiHandler();
