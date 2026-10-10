import type { APIGatewayProxyResult } from "aws-lambda";

export function ok<T>(body: T, headers: Record<string, string> = {}): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  };
}

export function serverError(message = "Internal Server Error"): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  };
}
