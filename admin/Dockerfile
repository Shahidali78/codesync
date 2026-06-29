FROM php:8.2-cli-alpine

RUN docker-php-ext-install pdo pdo_pgsql \
 && rm -rf /tmp/pear

WORKDIR /app
COPY . .

EXPOSE 8000

# -t public   → docroot for static files
# public/router.php → every non-static request goes through this script
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "public/router.php"]
