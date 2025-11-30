import { OpenAPIV3 } from 'openapi-types';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Load OpenAPI specification from YAML file
const yamlFilePath = path.join(__dirname, '../../../swagger.yaml');
const fileContents = fs.readFileSync(yamlFilePath, 'utf8');
export const swaggerSpec = yaml.load(fileContents) as OpenAPIV3.Document;

// Swagger UI options
export const swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Media Tracking API Documentation',
};

// Keep backward compatibility
export const swaggerDocument = swaggerSpec;
export default swaggerDocument;