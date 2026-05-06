const City = require('../models/City');

const getCities = async (req, res) => {
  try {
    // Haritada boş/yanlış şehir balonlarını (0 mekan) göstermeyelim.
    const cities = await City.find({ placeCount: { $gt: 0 } }).sort({ placeCount: -1 });
    res.json(cities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCity = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json({ message: 'City not found' });
    res.json(city);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCities, getCity };
