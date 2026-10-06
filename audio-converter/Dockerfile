FROM python:3.12-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY server.py .
USER nobody
EXPOSE 8080
CMD ["python", "-u", "server.py"]
