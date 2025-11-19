const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// Initialize S3 client
const s3Client = new S3Client({});

// Environment variables
const PRODUCT_IMAGES_BUCKET = process.env.PRODUCT_IMAGES_BUCKET;
const PRESIGNED_URL_EXPIRATION = parseInt(process.env.PRESIGNED_URL_EXPIRATION || '300', 10); // 5 minutes default

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Allowed content types
const ALLOWED_CONTENT_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
];

// Max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Lambda handler to generate presigned URL for S3 upload
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variable
        if (!PRODUCT_IMAGES_BUCKET) {
            throw new Error('PRODUCT_IMAGES_BUCKET environment variable is not set');
        }

        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Invalid JSON in request body'
                })
            };
        }

        const { filename, contentType, fileSize } = body;

        // Validate required fields
        if (!filename) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Filename is required'
                })
            };
        }

        if (!contentType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Content type is required'
                })
            };
        }

        // Validate content type
        if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: `Content type '${contentType}' is not allowed. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`
                })
            };
        }

        // Validate file size if provided
        if (fileSize && fileSize > MAX_FILE_SIZE) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
                })
            };
        }

        // Generate unique key for S3 object
        const fileExtension = filename.split('.').pop();
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `products/${timestamp}-${randomString}-${sanitizedFilename}`;

        console.log('Generating presigned URL for key:', key);

        // Create PutObject command
        const command = new PutObjectCommand({
            Bucket: PRODUCT_IMAGES_BUCKET,
            Key: key,
            ContentType: contentType,
            Metadata: {
                'original-filename': filename,
                'uploaded-at': new Date().toISOString()
            }
        });

        // Generate presigned URL
        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: PRESIGNED_URL_EXPIRATION
        });

        console.log('Successfully generated presigned URL');

        // Construct the final URL for accessing the uploaded file
        const fileUrl = `https://${PRODUCT_IMAGES_BUCKET}.s3.amazonaws.com/${key}`;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                uploadUrl: presignedUrl,
                key: key,
                fileUrl: fileUrl,
                expiresIn: PRESIGNED_URL_EXPIRATION,
                contentType: contentType
            })
        };

    } catch (error) {
        console.error('Error generating presigned URL:', error);

        // Determine if it's a validation error or server error
        const statusCode = error.message.includes('environment variable') || 
                          error.message.includes('required') ||
                          error.message.includes('not allowed')
            ? 400 
            : 500;

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to generate presigned URL',
                error: error.message
            })
        };
    }
};
