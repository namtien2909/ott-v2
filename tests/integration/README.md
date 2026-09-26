# Integration tests

Integration tests cross a real application boundary. The W0 health test uses the server app factory with Fastify injection so it does not bind a port. Database, realtime, and PlayHTML integration tests are added only when those boundaries exist.
