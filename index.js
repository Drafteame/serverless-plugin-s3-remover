/**
 * S3Remover is a serverless plugin that hooks into the 'before:remove:remove' lifecycle event to
 * empty the S3 deployment buckets associated to the service before removing the stack.
 */
class S3Remover {
  constructor(serverless, options, { log, progress }) {
    this.serverless = serverless;
    this.options = options;
    this.log = log;
    this.progress = progress;

    this.provider = this.serverless.getProvider('aws');

    this.hooks = {
      'before:remove:remove': this.remove.bind(this),
    };
  }

  /**
   * Is the main entrypoint of the plugin. It gets the list of buckets to empty and then empties
   * them.
   *
   * @returns {Promise<void>}
   */
  async remove() {
    const removeProgress = this.progress.create({
      message: 'Emptying S3 buckets...',
    });

    let bucketNames;

    try {
      bucketNames = await this.#getBuckets();
      this.#logInfo(`found bucket ${bucketNames}`);
    } catch (e) {
      this.#logError(`error getting bucket name: ${e.message}`);
      return;
    }

    const bucketPromises = [];

    bucketNames.forEach((name) => bucketPromises.push(this.#emptyBucket(name)));

    try {
      await Promise.all(bucketPromises);
    } catch (e) {
      this.#logError(`error emptying bucket: ${e.message}`);
      removeProgress.remove();
      return;
    }

    removeProgress.remove();
  }

  /**
   * Empties the bucket with the given name.
   *
   * @param {string} bucketName
   * @returns {Promise<void>}
   * @private
   */
  async #emptyBucket(bucketName) {
    const keys = await this.#getAllKeys(bucketName);

    try {
      await this.#deleteObjects(bucketName, keys);
      this.#logInfo(`bucket ${bucketName} emptied`);
    } catch (e) {
      this.#logError(`error emptying bucket ${bucketName}: ${e.message}`);
    }
  }

  /**
   * Gets all the keys in the bucket with the given name.
   *
   * @param {string} name
   * @returns {Promise<Array<string>>}
   * @private
   */
  async #getAllKeys(name) {
    return this.#getKeys(name, [], null);
  }

  /**
   * Gets the keys in the bucket with the given name. Firsts time it is called it will get the
   * first 1000 keys, then it will recursively call itself until all the keys are retrieved.
   *
   * @param {string} name Bucket name
   * @param {Array<string>} keys Previous keys retrieved
   * @param {string|null} nextToken Token given from the S3 response on the field
   *        NextContinuationToken
   * @returns {Promise<Array<string>>}
   * @private
   */
  async #getKeys(name, keys, nextToken) {
    const objects = await this.#listObjects(name, nextToken);

    if (objects.Contents.length === 0) {
      return keys;
    }

    objects.Contents.forEach((object) => keys.push(object.Key));

    if (objects.IsTruncated) {
      return this.#getKeys(name, keys, objects.NextContinuationToken);
    }

    return keys;
  }

  /**
   * Deletes the objects with the given keys from the bucket with the given name.
   *
   * @param {string} bucketName
   * @param {Array<string>} keys
   * @returns {Promise<void>}
   * @private
   */
  async #deleteObjects(bucketName, keys) {
    const res = await this.provider.request('S3', 'deleteObjects', {
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    let flag = false;

    res.Errors.forEach((error) => {
      flag = true;
      this.#logError(`error deleting object ${error.Key}: ${error.Code}`);
    });

    if (flag) {
      throw new Error('Error deleting objects');
    }
  }

  /**
   * Lists the objects in the bucket with the given name. If the nextToken is given, it will list
   * the objects starting from that token.
   *
   * @param {string} bucketName
   * @param {string} nextToken
   * @returns {Promise<Object>}
   * @private
   */
  async #listObjects(bucketName, nextToken) {
    return this.provider.request('S3', 'listObjectsV2', {
      Bucket: bucketName,
      ContinuationToken: nextToken,
    });
  }

  /**
   * Gets the list of buckets matching the associated deployment bucket name.
   * If no bucket is found, it will throw an error.
   *
   * @returns {Promise<Array<string>>}
   * @throws {Error} If no bucket is found
   * @private
   */
  async #getBuckets() {
    const regexp = this.#getBucketNameRegexp();

    const data = await this.provider.request('S3', 'listBuckets', {});

    const filtered = data.Buckets
      .map((bucket) => bucket.Name)
      .filter((name) => new RegExp(regexp).test(name));

    if (filtered.length === 0) {
      throw new Error(`No buckets found matching the regexp ${regexp}`);
    }

    return filtered;
  }

  /**
   * Gets the regexp to match the associated deployment bucket name.
   * If the deployment bucket name is not set, it will use the default naming convention.
   *
   * @returns {string}
   * @private
   */
  #getBucketNameRegexp() {
    let name = this.serverless.service.provider.deploymentBucket?.name;
    if (name) {
      return `^${name}`;
    }

    name = this.serverless.service.provider.deploymentBucket;
    if (typeof name === 'string' && name !== '') {
      return `^${name}`;
    }

    const { service } = this.serverless.service;
    const { stage } = this.serverless.service.provider;

    return `^${service}-${stage}-serverlessdeploymentbucket`;
  }

  #logError(message) {
    this.log.error(`S3 Remover: ${message}`);
  }

  #logInfo(message) {
    this.log.info(`S3 Remover: ${message}`);
  }
}

module.exports = S3Remover;
