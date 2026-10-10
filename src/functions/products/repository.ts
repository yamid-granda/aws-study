import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
  productSchema,
} from "./validation.js";

/**
 * Pure-ish repository: all DynamoDB access lives here so the handler stays
 * thin and unit tests can inject a mocked doc client. No `process.env`
 * access here — the caller passes `tableName` in.
 */

function parseProduct(item: unknown): Product | null {
  const parsed = productSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

export async function createProduct(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  product: Product,
): Promise<Product> {
  await docClient.send(new PutCommand({ TableName: tableName, Item: product }));
  return product;
}

export async function getProduct(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  id: string,
): Promise<Product | null> {
  const res = await docClient.send(new GetCommand({ TableName: tableName, Key: { id } }));
  if (!res.Item) {
    return null;
  }
  return parseProduct(res.Item);
}

export async function listProducts(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  limit = 20,
): Promise<Product[]> {
  const res = await docClient.send(new ScanCommand({ TableName: tableName, Limit: limit }));
  return (res.Items ?? []).map(parseProduct).filter((p): p is Product => p !== null);
}

export async function updateProduct(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  id: string,
  input: UpdateProductInput,
): Promise<Product | null> {
  const fields: { name: keyof UpdateProductInput; value: unknown }[] = (
    Object.entries(input) as [keyof UpdateProductInput, unknown][]
  ).map(([name, value]) => ({ name, value }));
  const now = new Date().toISOString();
  const setClauses = [...fields.map((f) => `#${f.name} = :${f.name}`), "#updatedAt = :updatedAt"];
  try {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: `SET ${setClauses.join(", ")}`,
        ExpressionAttributeNames: {
          ...Object.fromEntries(fields.map((f) => [`#${f.name}`, f.name])),
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ...Object.fromEntries(fields.map((f) => [`:${f.name}`, f.value])),
          ":updatedAt": now,
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      }),
    );
    // Parse to drop malformed rows; return null when the item is missing.
    if (!res.Attributes) {
      return null;
    }
    return parseProduct(res.Attributes);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "ConditionalCheckFailedException"
    ) {
      return null;
    }
    throw err;
  }
}

export async function deleteProduct(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  id: string,
): Promise<boolean> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
      }),
    );
    return true;
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "ConditionalCheckFailedException"
    ) {
      return false;
    }
    throw err;
  }
}

export type { CreateProductInput, Product };
