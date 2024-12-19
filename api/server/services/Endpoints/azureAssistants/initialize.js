const OpenAI = require('openai');
const { ProxyAgent } = require('undici');
const { constructAzureURL, isUserProvided, resolveHeaders } = require('@librechat/api');
const { ErrorTypes, EModelEndpoint, mapModelToAzureConfig } = require('librechat-data-provider');
const {
  checkUserKeyExpiry,
  getUserKeyValues,
  getUserKeyExpiry,
} = require('~/server/services/UserService');
const OAIClient = require('~/app/clients/OpenAIClient');

class Files {
  constructor(client) {
    this._client = client;
  }
  /**
   * Create an assistant file by attaching a
   * [File](https://platform.openai.com/docs/api-reference/files) to an
   * [assistant](https://platform.openai.com/docs/api-reference/assistants).
   */
  create(assistantId, body, options) {
    return this._client.post(`/assistants/${assistantId}/files`, {
      body,
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Retrieves an AssistantFile.
   */
  retrieve(assistantId, fileId, options) {
    return this._client.get(`/assistants/${assistantId}/files/${fileId}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Delete an assistant file.
   */
  del(assistantId, fileId, options) {
    return this._client.delete(`/assistants/${assistantId}/files/${fileId}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }
}

class VectorStoreFiles {
  constructor(client) {
    this._client = client;
  }

  /**
   * Create a vector store file
   * [File](https://platform.openai.com/docs/api-reference/vector-stores-files) to an
   * [Vector store](https://platform.openai.com/docs/api-reference/vector-stores).
   */
  create(vectorstoreId, body, options) {
    return this._client.post(`/vector_stores/${vectorstoreId}/files`, {
      body,
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Lists all vector store files
   */
  async list(vectorstoreId, options) {
    // TODO paginate instead of setting a hard limit
    return this._client.get(`/vector_stores/${vectorstoreId}`, {
      query: { limit: 100 },
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Retrieves a vector store file
   */
  retrieve(vectorstoreId, fileId, options) {
    return this._client.get(`/vector_stores/${vectorstoreId}/files/${fileId}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Delete a vector store file
   */
  del(vectorstoreId, fileId, options) {
    return this._client.delete(`/vector_stores/${vectorstoreId}/files/${fileId}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }
}

class VectorStore {
  constructor(client) {
    this._client = client;
    this._assistants = {};
    this.files = new VectorStoreFiles(client);
  }

  async _list(options) {
    // TODO paginate instead of setting a hard limit
    return this._client.get("/vector_stores", {
      query: { limit: 100 },
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  async _retrieveForAssistant(assistantId, options) {
    if (!this._assistants[assistantId]) {
      this._assistants[assistantId] = {};
      const vectorStores = await this._list(options);
      const aVectorStore = (vectorStores?.data || []).find((vs) => {
        return vs.name == this.name(assistantId);
      });
      if (aVectorStore) {
        this._assistants[assistantId] = {[aVectorStore.name]: aVectorStore};
      }
    }

    return this._assistants[assistantId][this.name(assistantId)]
  }

  name(assistantId) {
    return `${assistantId}_vector_store`;
  }

  /**
   * Create a vector store
   * [Vector store](https://platform.openai.com/docs/api-reference/vector-stores).
   */
  async create(assistantId, options) {
    const existingVectorStore = await this._retrieveForAssistant(assistantId, options);
    if (existingVectorStore) {
      return existingVectorStore;
    }

    const newVectorStore = await this._client.post(`/vector_stores`, {
      body: { name: this.name(assistantId) },
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
    this._assistants[assistantId] = {[newVectorStore.name]: newVectorStore};

    return newVectorStore;
  }

  /**
   * Retrieves a vector store
   */
  async retrieve(assistantId, options) {
    const existingVectorStore = await this._retrieveForAssistant(assistantId, options);
    if (existingVectorStore) {
      return existingVectorStore;
    }

    return this._client.get(`/vector_stores/${this.name(assistantId)}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }

  /**
   * Deletes a vector store
   */
  del(assistantId, options) {
    return this._client.delete(`/vector_stores/${this.name(assistantId)}`, {
      ...options,
      headers: { 'OpenAI-Beta': 'assistants=v1', ...options?.headers },
    });
  }
}

const initializeClient = async ({ req, res, version, endpointOption, initAppClient = false }) => {
  const { PROXY, OPENAI_ORGANIZATION, AZURE_ASSISTANTS_API_KEY, AZURE_ASSISTANTS_BASE_URL } =
    process.env;

  const userProvidesKey = isUserProvided(AZURE_ASSISTANTS_API_KEY);
  const userProvidesURL = isUserProvided(AZURE_ASSISTANTS_BASE_URL);

  let userValues = null;
  if (userProvidesKey || userProvidesURL) {
    const expiresAt = await getUserKeyExpiry({
      userId: req.user.id,
      name: EModelEndpoint.azureAssistants,
    });
    checkUserKeyExpiry(expiresAt, EModelEndpoint.azureAssistants);
    userValues = await getUserKeyValues({
      userId: req.user.id,
      name: EModelEndpoint.azureAssistants,
    });
  }

  let apiKey = userProvidesKey ? userValues.apiKey : AZURE_ASSISTANTS_API_KEY;
  let baseURL = userProvidesURL ? userValues.baseURL : AZURE_ASSISTANTS_BASE_URL;

  const opts = {};

  const clientOptions = {
    reverseProxyUrl: baseURL ?? null,
    proxy: PROXY ?? null,
    req,
    res,
    ...endpointOption,
  };

  /** @type {TAzureConfig | undefined} */
  const azureConfig = req.app.locals[EModelEndpoint.azureOpenAI];

  /** @type {AzureOptions | undefined} */
  let azureOptions;

  if (azureConfig && azureConfig.assistants) {
    const { modelGroupMap, groupMap, assistantModels } = azureConfig;
    const modelName = req.body.model ?? req.query.model ?? assistantModels[0];
    const {
      azureOptions: currentOptions,
      baseURL: azureBaseURL,
      headers = {},
      serverless,
    } = mapModelToAzureConfig({
      modelName,
      modelGroupMap,
      groupMap,
    });

    azureOptions = currentOptions;

    baseURL = constructAzureURL({
      baseURL: azureBaseURL ?? 'https://${INSTANCE_NAME}.openai.azure.com/openai',
      azureOptions,
    });

    apiKey = azureOptions.azureOpenAIApiKey;
    opts.defaultQuery = { 'api-version': azureOptions.azureOpenAIApiVersion };
    opts.defaultHeaders = resolveHeaders({
      headers: {
        ...headers,
        'api-key': apiKey,
        'OpenAI-Beta': `assistants=${version}`,
      },
      user: req.user,
    });
    opts.model = azureOptions.azureOpenAIApiDeploymentName;

    if (initAppClient) {
      clientOptions.titleConvo = azureConfig.titleConvo;
      clientOptions.titleModel = azureConfig.titleModel;
      clientOptions.titleMethod = azureConfig.titleMethod ?? 'completion';

      const groupName = modelGroupMap[modelName].group;
      clientOptions.addParams = azureConfig.groupMap[groupName].addParams;
      clientOptions.dropParams = azureConfig.groupMap[groupName].dropParams;
      clientOptions.forcePrompt = azureConfig.groupMap[groupName].forcePrompt;

      clientOptions.reverseProxyUrl = baseURL ?? clientOptions.reverseProxyUrl;
      clientOptions.headers = opts.defaultHeaders;
      clientOptions.azure = !serverless && azureOptions;
      if (serverless === true) {
        clientOptions.defaultQuery = azureOptions.azureOpenAIApiVersion
          ? { 'api-version': azureOptions.azureOpenAIApiVersion }
          : undefined;
        clientOptions.headers['api-key'] = apiKey;
      }
    }
  }

  if (userProvidesKey & !apiKey) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_USER_KEY,
      }),
    );
  }

  if (!apiKey) {
    throw new Error('Assistants API key not provided. Please provide it again.');
  }

  if (baseURL) {
    opts.baseURL = baseURL;
  }

  if (PROXY) {
    const proxyAgent = new ProxyAgent(PROXY);
    opts.fetchOptions = {
      dispatcher: proxyAgent,
    };
  }

  if (OPENAI_ORGANIZATION) {
    opts.organization = OPENAI_ORGANIZATION;
  }

  /** @type {OpenAIClient} */
  const openai = new OpenAI({
    apiKey,
    ...opts,
  });

  openai.beta.assistants.files = new Files(openai);
  openai.beta.assistants.vector_store = new VectorStore(openai);

  openai.req = req;
  openai.res = res;

  if (azureOptions) {
    openai.locals = { ...(openai.locals ?? {}), azureOptions };
  }

  if (endpointOption && initAppClient) {
    const client = new OAIClient(apiKey, clientOptions);
    return {
      client,
      openai,
      openAIApiKey: apiKey,
    };
  }

  return {
    openai,
    openAIApiKey: apiKey,
  };
};

module.exports = initializeClient;
