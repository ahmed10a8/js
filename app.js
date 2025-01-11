// Complete Shopify App for Bundle Upsell

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Shopify } = require('@shopify/shopify-api');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database setup
mongoose.connect('mongodb://localhost:27017/shopify_bundles', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const BundleSchema = new mongoose.Schema({
  shop: String,
  bundleName: String,
  products: [String],
  discount: Number,
});

const Bundle = mongoose.model('Bundle', BundleSchema);

// Shopify app configuration
const PORT = process.env.PORT || 3000;

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: ['write_products', 'read_products'],
  HOST_NAME: process.env.SHOPIFY_HOST,
  API_VERSION: '2023-01', // Adjust to the latest supported version
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Authentication
app.get('/auth', async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter.');

  const authRoute = await Shopify.Auth.beginAuth(req, res, shop, '/auth/callback', false);
  res.redirect(authRoute);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const session = await Shopify.Auth.validateAuthCallback(req, res, req.query);
    res.redirect(`/dashboard?shop=${session.shop}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed.');
  }
});

// Fetch products from Shopify
app.get('/products', async (req, res) => {
  try {
    const session = await Shopify.Utils.loadCurrentSession(req, res);
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    const products = await client.get({ path: 'products' });
    res.status(200).json(products.body);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to fetch products.');
  }
});

// Create a new bundle
app.post('/create-bundle', async (req, res) => {
  const { shop, bundleName, products, discount } = req.body;
  if (!shop || !bundleName || !products || !discount) {
    return res.status(400).send('Missing bundle details.');
  }

  try {
    const newBundle = new Bundle({ shop, bundleName, products, discount });
    await newBundle.save();
    res.status(201).send(`Bundle "${bundleName}" created successfully!`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to create bundle.');
  }
});

// Get all bundles for a shop
app.get('/bundles', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop parameter.');

  try {
    const bundles = await Bundle.find({ shop });
    res.status(200).json(bundles);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to fetch bundles.');
  }
});

// Update a bundle
app.put('/update-bundle/:id', async (req, res) => {
  const { id } = req.params;
  const { bundleName, products, discount } = req.body;

  try {
    const updatedBundle = await Bundle.findByIdAndUpdate(
      id,
      { bundleName, products, discount },
      { new: true }
    );
    res.status(200).send(`Bundle "${updatedBundle.bundleName}" updated successfully!`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to update bundle.');
  }
});

// Delete a bundle
app.delete('/delete-bundle/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await Bundle.findByIdAndDelete(id);
    res.status(200).send('Bundle deleted successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to delete bundle.');
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.send('Welcome to the Bundle Upsell Dashboard!');
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}`);
});
