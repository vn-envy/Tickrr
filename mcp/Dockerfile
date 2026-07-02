FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .

# Cloud Run: serve the MCP over streamable-HTTP on $PORT (default 8080).
ENV TICKRR_MCP_TRANSPORT=http
EXPOSE 8080
CMD ["python", "server.py"]
