import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { getDocClient, getTableName } from "../../shared/dynamo.js";
import { logger } from "../../shared/logger.js";
import { badRequest, ok, serverError } from "../../shared/response.js";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "./repository.js";
import {
  buildProduct,
  createProductSchema,
  listQuerySchema,
  productIdSchema,
  updateProductSchema,
} from "./validation.js";

function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  };
}

function created<T>(body: T): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyEvent): unknown {
  if (!event.body) {
    return undefined;
  }
  try {
    return JSON.parse(event.body);
  } catch {
    return undefined;
  }
}

/**
 * Products CRUD backed by DynamoDB (single table, PK = id).
 *
 * Routes (one Lambda, five Api events):
 *   POST   /products       — create
 *   GET    /products       — list (?limit=, default 20, max 100)
 *   GET    /products/{id}  — get one
 *   PUT    /products/{id}  — partial update
 *   DELETE /products/{id}  — delete
 */
export async function productsHandler(
  event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  let tableName: string;
  try {
    tableName = getTableName();
  } catch (err) {
    logger.error("TABLE_NAME is not configured", { err });
    return serverError("Service misconfigured");
  }
  const docClient = getDocClient();
  const method = event.httpMethod;
  const path = event.resource || event.path;

  try {
    // POST /products
    if (method === "POST" && path === "/products") {
      const parsed = createProductSchema.safeParse(parseBody(event));
      if (!parsed.success) {
        logger.warn("invalid create-product body", { issues: parsed.error.issues });
        return badRequest("Invalid product data");
      }
      const product = buildProduct(parsed.data);
      await createProduct(docClient, tableName, product);
      logger.info("product created", { id: product.id });
      return created({ product });
    }

    // GET /products
    if (method === "GET" && path === "/products") {
      const parsed = listQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) {
        return badRequest("Invalid query parameters");
      }
      const products = await listProducts(docClient, tableName, parsed.data.limit ?? 20);
      return ok({ products });
    }

    // Routes with {id}
    if (path === "/products/{id}") {
      const idParsed = productIdSchema.safeParse(event.pathParameters ?? {});
      if (!idParsed.success) {
        return badRequest("Invalid product id");
      }
      const { id } = idParsed.data;

      if (method === "GET") {
        const product = await getProduct(docClient, tableName, id);
        if (!product) {
          return notFound("Product not found");
        }
        return ok({ product });
      }

      if (method === "PUT") {
        const bodyParsed = updateProductSchema.safeParse(parseBody(event));
        if (!bodyParsed.success) {
          logger.warn("invalid update-product body", { issues: bodyParsed.error.issues });
          return badRequest("Invalid product data");
        }
        const product = await updateProduct(docClient, tableName, id, bodyParsed.data);
        if (!product) {
          return notFound("Product not found");
        }
        logger.info("product updated", { id });
        return ok({ product });
      }

      if (method === "DELETE") {
        const deleted = await deleteProduct(docClient, tableName, id);
        if (!deleted) {
          return notFound("Product not found");
        }
        logger.info("product deleted", { id });
        return ok({ deleted: true, id });
      }
    }

    return notFound("Route not found");
  } catch (err) {
    logger.error("products request failed", { err, method, path });
    return serverError();
  }
}

export const handler = middy(productsHandler);
