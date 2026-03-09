# README for developers

## Running locally

1. Make sure you have docker installed
2. Obtain an `audio.zip` of audio files and a database `dump.sql` that are compatible with each other.
3. Unzip `audio.zip` files to `gloud/data/kevbot-local-audio` directory
4. Put the `dump.sql` into the `db/migration/seeds/` directory. Note make sure you are aware of what schema version the dump is compatible with.
5. Create a symlink `.env` at root of directory to a valid environment variable file like `local_dev.env`

   ```sh
   ln -s local_dev.env .env
   ```

6. Start local versions of the `db` and `gcloud` storage by running:

   ```sh
   docker compose --env-file .env up [-d] [--build]
   ```

7. migrate the database

```bash
cd tools/db/migration_manager
docker build -t migration-manager1 .
cd /
docker run --rm --env-file .env -v ./db/migration:/app/migration migration-manager1 migrate migration
```

## Note on docker containers talking to each other

Use `host.docker.internal` if you have containers that are deployed together and need to talk to each other.

## Run node server not in docker container

1. Install

   ```sh
   cd src
   npm install
   ```

2. Make sure env is setup correctly create a symlink if needed. Use `localhost` instead of `host.docker.internal`.

3. Start the Application

   ```sh
   npm start
   ```

## gcloud metadata bug

For some reason, the mock gcloud has a bug that creates `<file>.metadata` files. But you get into a situation where you get metadata files for the already existing metadata files. So you get files like `example.mp3`, `example.mp3.metadata`, `example.mp3.metadata.metadata`, and etc. To fix this you can run the following commands

### Dry Run

```sh
find ./gcloud/data/kevbot-local-audio -type f -name '*.metadata*' -print
```

### Delete

> [!NOTE]
> There should only be one `.bucketMetadata` file per bucket.

```sh
find ./gcloud/data/kevbot-local-audio -type f -name '*.metadata*' -delete
rm ./gcloud/data/*.bucketMetadata
```
