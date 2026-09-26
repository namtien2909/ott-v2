import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  duration: "1s",
};

export default function () {
  const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3001";
  const response = http.get(`${baseUrl}/health`);
  check(response, {
    "health endpoint responds": (res) => res.status === 200,
  });
}
